import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getActiveKey, incrementQuotaUsed } from "@/lib/llm/key-manager";
import { callGroqVision } from "@/lib/llm/providers/groq";
import { logUsage } from "@/lib/llm/usage-logger";

// Instrucciones de extracción por defecto — se usan si no hay nada guardado en
// Configuración → IA/LLM → "Prompt OCR". El texto guardado en la BD REEMPLAZA
// por completo este bloque (no se concatena), para que el usuario tenga control
// total desde la interfaz sin depender de un despliegue de código.
const INSTRUCCIONES_DEFAULT = `- El RIF del emisor aparece cerca de "SENIAT" e inicia con J-, V-, E- o G-
- El teléfono puede venir precedido de: Teléfono, Telf, Tlf, Tel, Cel, Celular, Fono, Móvil
- La dirección del emisor suele aparecer debajo del nombre/RIF, antes de la fecha o el detalle de la factura (puede ocupar varias líneas: avenida, centro comercial, local, sector, ciudad, zona postal). Únela en un solo texto
- Si un ítem no tiene cantidad explícita, usa 1
- Reemplaza comas decimales por punto en los montos (ej: 2.189,58 → 2189.58)
- Si un campo no es legible usa null`;

// Formato de salida — fijo en el código porque el parser depende de estos nombres exactos de campo
const FORMATO_JSON = `{"proveedorNombre":"nombre del emisor","proveedorRif":"RIF con prefijo J-, V-, E- o G-","proveedorTelefono":"teléfono o null","proveedorDireccion":"dirección completa del emisor o null","numeroFactura":"número de factura o null","fecha":"YYYY-MM-DD o null","items":[{"nombre":"producto","cantidad":1,"costoUnitBs":0.00}]}`;

function construirPrompt(instrucciones: string): string {
  return `Analiza esta imagen de factura venezolana y extrae los datos del encabezado y los productos.

Instrucciones:
${instrucciones}

Responde ÚNICAMENTE con este objeto JSON (sin texto, sin markdown, sin bloques de código):
${FORMATO_JSON}`;
}

function parseOcrResponse(rawText: string): Record<string, unknown> | null {
  const noThink = rawText.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "");
  const stripped = noThink.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { imagenBase64, mimeType = "image/jpeg" } = body;
  if (!imagenBase64) return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });

  // Instrucciones configurables desde Configuración → IA/LLM. Si hay algo guardado,
  // reemplaza por completo las instrucciones por defecto (no se concatena).
  let instruccionesBD = "";
  try {
    const cfgResult = await pool.query(
      `SELECT valor FROM configuracion WHERE clave = 'compras_ocr_prompt'`
    );
    instruccionesBD = cfgResult.rows[0]?.valor ?? "";
  } catch { /* tabla o clave no existe */ }

  const instrucciones = instruccionesBD.trim() || INSTRUCCIONES_DEFAULT;
  const promptFull = construirPrompt(instrucciones);

  // ── 1. Intentar con Gemini (visión nativa + responseSchema) ─────────────────
  const geminiKey = await getActiveKey("gemini");
  if (geminiKey) {
    try {
      const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey.decryptedKey}`;

      const geminiBody = {
        contents: [{ parts: [
          { text: promptFull },
          { inline_data: { mime_type: mimeType, data: imagenBase64 } },
        ]}],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              proveedorNombre:    { type: "STRING" },
              proveedorRif:       { type: "STRING" },
              proveedorTelefono:  { type: "STRING" },
              proveedorDireccion: { type: "STRING" },
              numeroFactura:      { type: "STRING" },
              fecha:             { type: "STRING" },
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    nombre:      { type: "STRING" },
                    cantidad:    { type: "NUMBER" },
                    costoUnitBs: { type: "NUMBER" },
                  },
                },
              },
            },
          },
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      });

      if (res.ok) {
        const data = await res.json();
        const candidate = data?.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (candidate && finishReason !== "SAFETY" && finishReason !== "RECITATION") {
          if (finishReason === "MAX_TOKENS") {
            return NextResponse.json({ error: "La factura tiene demasiados ítems. Intenta con menos productos visibles." }, { status: 422 });
          }
          const rawText: string = candidate?.content?.parts?.[0]?.text ?? "";
          if (rawText.trim()) {
            const parsed = parseOcrResponse(rawText);
            const items = parsed?.items;
            const tieneItems = Array.isArray(items) && items.length > 0;
            if (parsed && tieneItems) {
              await incrementQuotaUsed(geminiKey.id, 0);
              await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", model: modelName, tokens: { prompt: 0, completion: 0, total: 0 }, latency: 0, status: "ok", context: "ocr" });
              return NextResponse.json({ ok: true, data: parsed, provider: "gemini", _raw: rawText.slice(0, 500), _extraContext: instrucciones.slice(0, 300) });
            }
            // Respuesta incompleta (sin ítems) — se descarta y se intenta con Groq
            await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", status: "failback", errorCode: "respuesta_sin_items", context: "ocr" });
          }
        }
      } else if (res.status !== 429 && res.status !== 503) {
        // Error no recuperable (400, 401, etc.) → no hacer fallback
        const err = await res.text();
        return NextResponse.json({ error: `Gemini error ${res.status}: ${err}` }, { status: 502 });
      } else {
        // 429 / 503 → continúa al fallback con Groq
        await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", status: "failback", errorCode: String(res.status), context: "ocr" });
      }
    } catch {
      // timeout u otro error → continúa al fallback
    }
  }

  // ── 2. Fallback: Groq visión ─────────────────────────────────────────────────
  const groqKey = await getActiveKey("groq");
  if (!groqKey) {
    return NextResponse.json({ error: "Sin API keys disponibles para OCR (Gemini y Groq agotados o no configurados)." }, { status: 503 });
  }

  // Límite TPM de Groq (8000 tok/min en tier on-demand) incluye max_tokens en el cálculo de la solicitud;
  // se intenta con un presupuesto bajo y, si aun así excede el límite (413), se reintenta más bajo.
  for (const maxTokens of [2000, 800]) {
    try {
      const start = Date.now();
      const result = await callGroqVision(promptFull, imagenBase64, mimeType, {
        maxTokens,
        apiKey: groqKey.decryptedKey,
      });
      const latency = Date.now() - start;

      const parsed = parseOcrResponse(result.text);
      if (!parsed) {
        return NextResponse.json({ error: `OCR (Groq) sin JSON válido: "${result.text.slice(0, 200)}"` }, { status: 422 });
      }

      await incrementQuotaUsed(groqKey.id, result.tokens.total);
      await logUsage({ apiKeyId: groqKey.id, provider: "groq", model: result.model, tokens: result.tokens, latency, status: "ok", context: "ocr" });

      return NextResponse.json({ ok: true, data: parsed, provider: "groq", _raw: result.text.slice(0, 500), _extraContext: instrucciones.slice(0, 300) });
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 413 && maxTokens !== 800) continue; // reintentar con presupuesto menor
      return NextResponse.json({ error: `OCR Groq error: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
    }
  }
  return NextResponse.json({ error: "OCR Groq: no se pudo procesar la imagen dentro del límite de tokens." }, { status: 502 });
}

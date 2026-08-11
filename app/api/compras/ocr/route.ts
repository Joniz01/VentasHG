import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getActiveKey, getActiveKeys, incrementQuotaUsed } from "@/lib/llm/key-manager";
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

type OcrExito = { ok: true; data: Record<string, unknown>; provider: "gemini" | "groq"; raw: string };
type OcrFallo = { ok: false; hardError?: { message: string; status: number }; skipReason: string };
type OcrResultado = OcrExito | OcrFallo;

async function intentarGemini(promptFull: string, imagenBase64: string, mimeType: string): Promise<OcrResultado> {
  const geminiKeys = await getActiveKeys("gemini");
  let skipReason = "sin API key con cuota disponible";

  for (const geminiKey of geminiKeys) {
    try {
      const modelName = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
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
                  required: ["nombre", "cantidad", "costoUnitBs"],
                },
              },
            },
            // Fuerza a Gemini a incluir TODAS las claves (aunque sea con valor vacío/null)
            // en vez de omitirlas cuando no está seguro.
            required: ["proveedorNombre", "proveedorRif", "proveedorTelefono", "proveedorDireccion", "numeroFactura", "fecha", "items"],
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
            return { ok: false, hardError: { message: "La factura tiene demasiados ítems. Intenta con menos productos visibles.", status: 422 }, skipReason: "MAX_TOKENS" };
          }
          const rawText: string = candidate?.content?.parts?.[0]?.text ?? "";
          if (rawText.trim()) {
            const parsed = parseOcrResponse(rawText);
            const items = parsed?.items;
            const tieneItems = Array.isArray(items) && items.length > 0;
            if (parsed && tieneItems) {
              await incrementQuotaUsed(geminiKey.id, 0);
              await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", model: modelName, tokens: { prompt: 0, completion: 0, total: 0 }, latency: 0, status: "ok", context: "ocr" });
              return { ok: true, data: parsed, provider: "gemini", raw: rawText.slice(0, 500) };
            }
            skipReason = `respuesta 200 sin items (finishReason=${finishReason ?? "STOP"}, len=${rawText.length})`;
            await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", status: "failback", errorCode: "respuesta_sin_items", context: "ocr" });
          } else {
            skipReason = `rawText vacío (finishReason=${finishReason ?? "?"})`;
          }
        } else {
          skipReason = `candidate ausente o bloqueado (finishReason=${finishReason ?? "sin candidatos"})`;
        }
      } else if (res.status !== 429 && res.status !== 503) {
        const err = await res.text();
        return { ok: false, hardError: { message: `Gemini error ${res.status}: ${err}`, status: 502 }, skipReason: `HTTP ${res.status}` };
      } else {
        skipReason = `HTTP ${res.status}`;
        await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", status: "failback", errorCode: String(res.status), context: "ocr" });
      }
    } catch (err) {
      skipReason = `excepción: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return { ok: false, skipReason };
}

async function intentarGroq(promptFull: string, imagenBase64: string, mimeType: string): Promise<OcrResultado> {
  const groqKey = await getActiveKey("groq");
  if (!groqKey) {
    return { ok: false, skipReason: "sin API key configurada" };
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
        return { ok: false, hardError: { message: `OCR (Groq) sin JSON válido: "${result.text.slice(0, 200)}"`, status: 422 }, skipReason: "sin JSON válido" };
      }

      await incrementQuotaUsed(groqKey.id, result.tokens.total);
      await logUsage({ apiKeyId: groqKey.id, provider: "groq", model: result.model, tokens: result.tokens, latency, status: "ok", context: "ocr" });

      return { ok: true, data: parsed, provider: "groq", raw: result.text.slice(0, 500) };
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 413 && maxTokens !== 800) continue; // reintentar con presupuesto menor
      return { ok: false, hardError: { message: `OCR Groq error: ${err instanceof Error ? err.message : String(err)}`, status: 502 }, skipReason: "error Groq" };
    }
  }
  return { ok: false, skipReason: "excede límite de tokens" };
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { imagenBase64, mimeType = "image/jpeg" } = body;
  if (!imagenBase64) return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });

  // Instrucciones + orden de proveedores, configurables desde Configuración → IA/LLM.
  let instruccionesBD = "";
  let ordenBD = "";
  try {
    const cfgResult = await pool.query(
      `SELECT clave, valor FROM configuracion WHERE clave IN ('compras_ocr_prompt', 'ocr_provider_orden')`
    );
    for (const row of cfgResult.rows) {
      if (row.clave === "compras_ocr_prompt") instruccionesBD = row.valor ?? "";
      if (row.clave === "ocr_provider_orden") ordenBD = row.valor ?? "";
    }
  } catch { /* tabla o clave no existe */ }

  const instrucciones = instruccionesBD.trim() || INSTRUCCIONES_DEFAULT;
  const promptFull = construirPrompt(instrucciones);

  const groqPrimero = ordenBD.trim() === "groq";
  const secuencia = groqPrimero
    ? [{ nombre: "groq" as const, fn: intentarGroq }, { nombre: "gemini" as const, fn: intentarGemini }]
    : [{ nombre: "gemini" as const, fn: intentarGemini }, { nombre: "groq" as const, fn: intentarGroq }];

  let ultimoMotivo = "";
  for (const { fn } of secuencia) {
    const resultado = await fn(promptFull, imagenBase64, mimeType);
    if (resultado.ok) {
      return NextResponse.json({ ok: true, data: resultado.data, provider: resultado.provider, _raw: resultado.raw });
    }
    if (resultado.hardError) {
      return NextResponse.json({ error: resultado.hardError.message }, { status: resultado.hardError.status });
    }
    ultimoMotivo = resultado.skipReason;
  }

  return NextResponse.json(
    { error: `Sin API keys disponibles para OCR (Gemini y Groq agotados, sin configurar, o fallaron). Último motivo: ${ultimoMotivo}` },
    { status: 503 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getActiveKey, getActiveKeys, incrementQuotaUsed } from "@/lib/llm/key-manager";
import { callGroqVision } from "@/lib/llm/providers/groq";
import { logUsage } from "@/lib/llm/usage-logger";

const INSTRUCCIONES_DEFAULT = `- El RIF del emisor aparece cerca de "SENIAT" e inicia con J-, V-, E- o G-
- El teléfono puede venir precedido de: Teléfono, Telf, Tlf, Tel, Cel, Celular, Fono, Móvil
- La dirección del emisor suele aparecer debajo del nombre/RIF
- Extrae el total de la factura como "totalFacturaBs"
- Busca la fecha de vencimiento si aparece; si no, usa la fecha de emisión
- Si un campo no es legible usa null`;

const FORMATO_JSON = `{"proveedorNombre":"nombre del emisor","proveedorRif":"RIF con prefijo J-, V-, E- o G-","proveedorTelefono":"teléfono o null","proveedorDireccion":"dirección completa del emisor o null","numeroFactura":"número de factura o null","fechaEmision":"YYYY-MM-DD o null","fechaVencimiento":"YYYY-MM-DD o null","totalFacturaBs":0.00}`;

function construirPrompt(): string {
  return `Analiza esta imagen de factura venezolana y extrae los datos del encabezado.

Instrucciones:
${INSTRUCCIONES_DEFAULT}

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

type OcrExito = { ok: true; data: Record<string, unknown>; provider: string; raw: string };
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
          maxOutputTokens: 2048,
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
              fechaEmision:       { type: "STRING" },
              fechaVencimiento:   { type: "STRING" },
              totalFacturaBs:     { type: "NUMBER" },
            },
            required: ["proveedorNombre", "proveedorRif", "proveedorTelefono", "proveedorDireccion", "numeroFactura", "fechaEmision", "fechaVencimiento", "totalFacturaBs"],
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
          const rawText: string = candidate?.content?.parts?.[0]?.text ?? "";
          if (rawText.trim()) {
            const parsed = parseOcrResponse(rawText);
            if (parsed) {
              await incrementQuotaUsed(geminiKey.id, 0);
              await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", model: modelName, tokens: { prompt: 0, completion: 0, total: 0 }, latency: 0, status: "ok", context: "ocr" });
              return { ok: true, data: parsed, provider: "gemini", raw: rawText.slice(0, 500) };
            }
            skipReason = "respuesta 200 sin JSON válido";
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
  if (!groqKey) return { ok: false, skipReason: "sin API key configurada" };

  for (const maxTokens of [1500, 600]) {
    try {
      const start = Date.now();
      const result = await callGroqVision(promptFull, imagenBase64, mimeType, { maxTokens, apiKey: groqKey.decryptedKey });
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
      if (code === 413 && maxTokens !== 600) continue;
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

  let ordenBD = "";
  try {
    const cfgResult = await pool.query(`SELECT valor FROM configuracion WHERE clave = 'ocr_provider_orden'`);
    ordenBD = cfgResult.rows[0]?.valor ?? "";
  } catch { /* ok */ }

  const promptFull = construirPrompt();
  const groqPrimero = ordenBD.trim() === "groq";
  const secuencia = groqPrimero
    ? [{ nombre: "groq" as const }, { nombre: "gemini" as const }]
    : [{ nombre: "gemini" as const }, { nombre: "groq" as const }];

  const PROVEEDORES = { gemini: intentarGemini, groq: intentarGroq } as const;

  let ultimoMotivo = "";
  for (const { nombre } of secuencia) {
    const resultado = await PROVEEDORES[nombre](promptFull, imagenBase64, mimeType);
    if (resultado.ok) return NextResponse.json({ ok: true, data: resultado.data, provider: resultado.provider });
    if (resultado.hardError) return NextResponse.json({ error: resultado.hardError.message }, { status: resultado.hardError.status });
    ultimoMotivo = resultado.skipReason;
  }

  return NextResponse.json(
    { error: `Sin API keys disponibles para OCR. Último motivo: ${ultimoMotivo}` },
    { status: 503 }
  );
}

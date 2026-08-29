import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { getActiveKey, getActiveKeys, incrementQuotaUsed } from "@/lib/llm/key-manager";
import { callGroqVision } from "@/lib/llm/providers/groq";
import { logUsage } from "@/lib/llm/usage-logger";

export const dynamic = "force-dynamic";

const PROMPT_CEDULA = `Analiza esta imagen de una Cédula de Identidad venezolana y extrae los datos del titular.

Instrucciones:
- El número de cédula aparece precedido de "V" o "E" (ej: V 20.246.331) — extrae solo los dígitos sin puntos ni espacios
- La NACIONALIDAD es "V" si el prefijo es V (venezolano) o "E" si es E (extranjero)
- Los APELLIDOS aparecen en la línea etiquetada "APELLIDOS"
- Los NOMBRES aparecen en la línea etiquetada "NOMBRES"
- La FECHA DE NACIMIENTO aparece etiquetada "F. NACIMIENTO" o "FECHA NAC" en formato DD/MM/AAAA — conviértela a YYYY-MM-DD
- El ESTADO CIVIL aparece etiquetado "EDO CIVIL" o "ESTADO CIVIL" — valores posibles: SOLTERO, CASADO, DIVORCIADO, VIUDO
- El SEXO no siempre aparece explícito en la cédula — si no está, usa null
- Si un campo no es legible usa null

Responde ÚNICAMENTE con este objeto JSON (sin texto, sin markdown, sin bloques de código):
{"cedula":"20246331","nacionalidad":"V","nombres":"HECTOR EMILIO","apellidos":"SANCHEZ MEZA","fechaNacimiento":"1991-04-06","sexo":null,"estadoCivil":"SOLTERO"}`;

type CedulaOcrResult = {
  cedula: string | null;
  nacionalidad: "V" | "E" | null;
  nombres: string | null;
  apellidos: string | null;
  fechaNacimiento: string | null;
  sexo: string | null;
  estadoCivil: string | null;
};

function parseResponse(raw: string): CedulaOcrResult | null {
  const noThink = raw.replace(/<think>[\s\S]*?(<\/think>|$)/gi, "");
  const stripped = noThink.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as CedulaOcrResult;
  } catch {
    return null;
  }
}

async function intentarGemini(imagenBase64: string, mimeType: string): Promise<{ ok: true; data: CedulaOcrResult; provider: "gemini" } | { ok: false; error?: string }> {
  const keys = await getActiveKeys("gemini");
  for (const key of keys) {
    try {
      const modelName = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key.decryptedKey}`;
      const body = {
        contents: [{ parts: [
          { text: PROMPT_CEDULA },
          { inline_data: { mime_type: mimeType, data: imagenBase64 } },
        ]}],
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              cedula:          { type: "STRING" },
              nacionalidad:    { type: "STRING" },
              nombres:         { type: "STRING" },
              apellidos:       { type: "STRING" },
              fechaNacimiento: { type: "STRING" },
              sexo:            { type: "STRING" },
              estadoCivil:     { type: "STRING" },
            },
            required: ["cedula", "nacionalidad", "nombres", "apellidos", "fechaNacimiento", "sexo", "estadoCivil"],
          },
        },
      };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const json = await res.json();
        const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (rawText.trim()) {
          const parsed = parseResponse(rawText);
          if (parsed) {
            await incrementQuotaUsed(key.id, 0);
            await logUsage({ apiKeyId: key.id, provider: "gemini", model: modelName, tokens: { prompt: 0, completion: 0, total: 0 }, latency: 0, status: "ok", context: "ocr-cedula" });
            return { ok: true, data: parsed, provider: "gemini" };
          }
        }
      } else if (res.status !== 429 && res.status !== 503) {
        return { ok: false, error: `Gemini error ${res.status}` };
      }
    } catch { /* intentar siguiente key */ }
  }
  return { ok: false };
}

async function intentarGroq(imagenBase64: string, mimeType: string): Promise<{ ok: true; data: CedulaOcrResult; provider: "groq" } | { ok: false; error?: string }> {
  const key = await getActiveKey("groq");
  if (!key) return { ok: false };
  try {
    const result = await callGroqVision(PROMPT_CEDULA, imagenBase64, mimeType, { maxTokens: 512, apiKey: key.decryptedKey });
    const parsed = parseResponse(result.text);
    if (!parsed) return { ok: false, error: "Sin JSON válido en respuesta Groq" };
    await incrementQuotaUsed(key.id, result.tokens.total);
    await logUsage({ apiKeyId: key.id, provider: "groq", model: result.model, tokens: result.tokens, latency: 0, status: "ok", context: "ocr-cedula" });
    return { ok: true, data: parsed, provider: "groq" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error Groq" };
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { imagenBase64, mimeType = "image/jpeg" } = body as { imagenBase64?: string; mimeType?: string };
  if (!imagenBase64) return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });

  const gemini = await intentarGemini(imagenBase64, mimeType);
  if (gemini.ok) return NextResponse.json({ ok: true, data: gemini.data, provider: gemini.provider });

  const groq = await intentarGroq(imagenBase64, mimeType);
  if (groq.ok) return NextResponse.json({ ok: true, data: groq.data, provider: groq.provider });

  return NextResponse.json(
    { error: groq.error ?? gemini.error ?? "Sin API keys disponibles para OCR de cédula" },
    { status: 503 }
  );
}

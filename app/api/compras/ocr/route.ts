import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { imagenBase64, mimeType = "image/jpeg" } = body;
  if (!imagenBase64) return NextResponse.json({ error: "Imagen requerida" }, { status: 400 });

  try {
    // Obtener prompt editable desde configuracion
    // El formato JSON siempre se fuerza; el prompt de BD agrega contexto extra si existe
    const cfgResult = await pool.query(
      `SELECT valor FROM configuracion WHERE clave = 'compras_ocr_prompt'`
    );
    const extraContext = cfgResult.rows[0]?.valor ?? "";

    const promptTemplate = `Analiza esta imagen de factura venezolana y extrae los datos.${extraContext ? ` ${extraContext}` : ""}

Responde ÚNICAMENTE con el siguiente objeto JSON (sin texto adicional, sin bloques de código, sin markdown):
{"proveedorNombre":"nombre del emisor/empresa","proveedorRif":"RIF del emisor con prefijo J-, V-, E- o G- si aparece","proveedorTelefono":"teléfono (busca: Teléfono, Telf, Tlf, Tel, Cel, Celular, Fono, Móvil)","numeroFactura":"número de factura","fecha":"YYYY-MM-DD o null","items":[{"nombre":"producto","cantidad":1,"costoUnitBs":0.00}]}`;

    // Obtener API key Gemini activa
    const keyResult = await pool.query(
      `SELECT id, api_key FROM llm_api_keys WHERE provider = 'gemini' AND is_active = TRUE ORDER BY id LIMIT 1`
    );
    if (!keyResult.rowCount) {
      return NextResponse.json({ error: "No hay API key Gemini configurada" }, { status: 503 });
    }

    const { api_key } = keyResult.rows[0];

    const { decryptKey } = await import("@/lib/llm/llm-config");
    const apiKey = decryptKey(api_key);

    const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiBody = {
      contents: [{
        parts: [
          { text: promptTemplate },
          { inline_data: { mime_type: mimeType, data: imagenBase64 } },
        ],
      }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0 },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini error ${res.status}: ${err}` }, { status: 502 });
    }

    const data = await res.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extraer JSON: quitar bloques markdown si existen, luego buscar primer objeto
    const stripped = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo extraer datos de la factura. Intenta con una imagen más clara.", raw: rawText }, { status: 422 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "La respuesta del OCR no tiene formato válido. Intenta nuevamente.", raw: rawText }, { status: 422 });
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

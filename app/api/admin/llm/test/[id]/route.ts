import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";
import { decryptKey, PROVIDER_TIMEOUTS, DEFAULT_MODELS } from "@/lib/llm/llm-config";
import { logUsage } from "@/lib/llm/usage-logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const result = await pool.query(
    `SELECT id, provider, api_key, is_active FROM llm_api_keys WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  }

  const key = result.rows[0];
  let decrypted: string;
  try {
    decrypted = decryptKey(key.api_key);
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo descifrar la key (¿cambió LLM_ENCRYPTION_KEY?)" }, { status: 500 });
  }

  const provider: string = key.provider;
  const start = Date.now();

  try {
    let text = "";
    if (provider === "gemini") {
      const model = DEFAULT_MODELS.gemini;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decrypted}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUTS.gemini);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responde solo: OK" }] }], generationConfig: { maxOutputTokens: 10 } }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status });
      const data = await res.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      const model = DEFAULT_MODELS.groq;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUTS.groq);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${decrypted}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "Responde solo: OK" }], max_tokens: 10 }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { statusCode: res.status });
      const data = await res.json();
      text = data?.choices?.[0]?.message?.content ?? "";
    }

    const latency = Date.now() - start;
    await logUsage({ apiKeyId: key.id, provider, status: "ok", latency, context: "admin-test-key" });
    return NextResponse.json({ ok: true, provider, text: text.trim(), latency });
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    await logUsage({ apiKeyId: key.id, provider, status: "error", errorCode: String(code ?? "unknown"), context: "admin-test-key" });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error desconocido" }, { status: 500 });
  }
}

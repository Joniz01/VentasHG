import { PROVIDER_TIMEOUTS, DEFAULT_MODELS } from "../llm-config";
import type { LLMResult } from "./gemini";

// Modelo Groq con soporte de visión para OCR de facturas
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";

export async function callGroqVision(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  opts: { maxTokens?: number; apiKey: string }
): Promise<LLMResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUTS.groq);

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        max_tokens: opts.maxTokens ?? 4096,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const error = new Error("Groq vision timeout o error de red") as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = "";
    try { const d = await res.json(); detail = d?.error?.message ?? JSON.stringify(d); } catch { /* ignore */ }

    // Diagnóstico: si el modelo no existe/no hay acceso, listar modelos reales disponibles en la cuenta
    let modelsHint = "";
    if (res.status === 404) {
      try {
        const mRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${opts.apiKey}` },
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          const ids: string[] = (mData?.data ?? []).map((m: { id: string }) => m.id);
          modelsHint = ` | Modelos disponibles en tu cuenta: ${ids.join(", ")}`;
        }
      } catch { /* ignore */ }
    }

    const error = new Error(`Groq vision HTTP ${res.status}${detail ? ": " + detail.slice(0, 200) : ""}${modelsHint}`) as Error & { statusCode: number };
    error.statusCode = res.status;
    throw error;
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage ?? {};

  return {
    text,
    model: GROQ_VISION_MODEL,
    tokens: {
      prompt:     usage.prompt_tokens     ?? 0,
      completion: usage.completion_tokens ?? 0,
      total:      usage.total_tokens      ?? 0,
    },
  };
}

export async function callGroq(
  prompt: string,
  opts: { system?: string; maxTokens?: number; model?: string; apiKey: string }
): Promise<LLMResult> {
  const modelName = opts.model ?? DEFAULT_MODELS.groq;
  const messages: { role: string; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUTS.groq);

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({ model: modelName, messages, max_tokens: opts.maxTokens ?? 1000 }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const error = new Error("Groq timeout o error de red") as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const error = new Error(`Groq HTTP ${res.status}`) as Error & { statusCode: number };
    error.statusCode = res.status;
    throw error;
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const usage = data?.usage ?? {};

  return {
    text,
    model: modelName,
    tokens: {
      prompt:     usage.prompt_tokens     ?? 0,
      completion: usage.completion_tokens ?? 0,
      total:      usage.total_tokens      ?? 0,
    },
  };
}

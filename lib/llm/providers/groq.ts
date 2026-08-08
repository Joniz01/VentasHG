import { PROVIDER_TIMEOUTS, DEFAULT_MODELS } from "../llm-config";
import type { LLMResult } from "./gemini";

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

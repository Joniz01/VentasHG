import { PROVIDER_TIMEOUTS, DEFAULT_MODELS } from "../llm-config";

export type LLMResult = {
  text: string;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
};

export async function callGemini(
  prompt: string,
  opts: { system?: string; maxTokens?: number; model?: string; apiKey: string }
): Promise<LLMResult> {
  const modelName = opts.model ?? DEFAULT_MODELS.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${opts.apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens ?? 1000 },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUTS.gemini);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const error = new Error("Gemini timeout o error de red") as Error & { statusCode: number };
    error.statusCode = 503;
    throw error;
  }
  clearTimeout(timer);

  if (!res.ok) {
    const error = new Error(`Gemini HTTP ${res.status}`) as Error & { statusCode: number };
    error.statusCode = res.status;
    throw error;
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? "";
  const usage = data?.usageMetadata ?? {};

  return {
    text,
    model: modelName,
    tokens: {
      prompt:     usage.promptTokenCount     ?? 0,
      completion: usage.candidatesTokenCount ?? 0,
      total:      usage.totalTokenCount      ?? 0,
    },
  };
}

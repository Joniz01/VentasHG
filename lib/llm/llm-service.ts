import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { logUsage } from "./usage-logger";
import { getActiveKey, incrementQuotaUsed } from "./key-manager";
import { FAILBACK_HTTP_CODES } from "./llm-config";

export type CallLLMOpts = {
  system?: string;
  maxTokens?: number;
  model?: string;
  context?: string;
};

export type CallLLMResult = {
  text: string;
  provider: string;
  tokens: { prompt: number; completion: number; total: number };
};

/**
 * Punto de entrada único para consultas LLM.
 * Intenta Gemini primero; hace failback a Groq ante errores recuperables.
 * Errores 400 (prompt inválido) se propagan directamente sin failback.
 */
export async function callLLM(prompt: string, opts: CallLLMOpts = {}): Promise<CallLLMResult> {
  const { system = "", maxTokens = 1000, model, context = "general" } = opts;

  // ── 1. Intentar Gemini ───────────────────────────────────────────────────
  const geminiKey = await getActiveKey("gemini");

  if (geminiKey) {
    try {
      const start = Date.now();
      const result = await callGemini(prompt, { system, maxTokens, model, apiKey: geminiKey.decryptedKey });
      const latency = Date.now() - start;

      await incrementQuotaUsed(geminiKey.id, result.tokens.total);
      await logUsage({ apiKeyId: geminiKey.id, provider: "gemini", model: result.model, tokens: result.tokens, latency, status: "ok", context });

      return { text: result.text, provider: "gemini", tokens: result.tokens };
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      const isAborted = err instanceof Error && err.message.includes("timeout");
      const isFailbackable = (code !== undefined && FAILBACK_HTTP_CODES.has(code)) || isAborted;

      await logUsage({
        apiKeyId: geminiKey.id,
        provider: "gemini",
        status: isFailbackable ? "failback" : "error",
        errorCode: String(code ?? (err instanceof Error ? err.message : "unknown")),
        context,
      });

      if (!isFailbackable) throw err; // 400 → no reintentar
      // Continúa al failback con Groq
    }
  }

  // ── 2. Failback: Groq ────────────────────────────────────────────────────
  const groqKey = await getActiveKey("groq");
  if (!groqKey) {
    throw new Error("LLM_NO_KEYS: No hay API keys activas disponibles (Gemini ni Groq).");
  }

  // Fix: try/catch en Groq para loguear el error si también falla
  try {
    const start = Date.now();
    const result = await callGroq(prompt, { system, maxTokens, model, apiKey: groqKey.decryptedKey });
    const latency = Date.now() - start;

    await incrementQuotaUsed(groqKey.id, result.tokens.total);
    await logUsage({ apiKeyId: groqKey.id, provider: "groq", model: result.model, tokens: result.tokens, latency, status: "ok", context });

    return { text: result.text, provider: "groq", tokens: result.tokens };
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    await logUsage({
      apiKeyId: groqKey.id,
      provider: "groq",
      status: "error",
      errorCode: String(code ?? (err instanceof Error ? err.message : "unknown")),
      context,
    });
    throw err;
  }
}

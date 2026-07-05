import { pool } from "@/lib/db";

export type UsageEntry = {
  apiKeyId?: number | null;
  provider: string;
  model?: string;
  tokens?: { prompt: number; completion: number; total: number };
  latency?: number;
  status: "ok" | "failback" | "error";
  errorCode?: string;
  context?: string;
};

export async function logUsage(entry: UsageEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO llm_usage_log
       (api_key_id, provider, model, prompt_tokens, completion_tokens,
        total_tokens, latency_ms, status, error_code, context)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.apiKeyId ?? null,
        entry.provider,
        entry.model ?? null,
        entry.tokens?.prompt ?? 0,
        entry.tokens?.completion ?? 0,
        entry.tokens?.total ?? 0,
        entry.latency ?? null,
        entry.status,
        entry.errorCode ?? null,
        entry.context ?? null,
      ]
    );
  } catch {
    // El log nunca debe bloquear el flujo principal
  }
}

export type UsageSummaryRow = {
  day: string;
  provider: string;
  calls_ok: number;
  calls_failback: number;
  calls_error: number;
  total_tokens: number;
  avg_latency_ms: number;
};

export async function getUsageSummary(days: number): Promise<UsageSummaryRow[]> {
  // Validar días como entero para evitar inyección SQL en el INTERVAL
  const safeDays = Math.max(1, Math.min(90, Math.floor(Number(days) || 7)));

  const result = await pool.query(
    `SELECT
       DATE_TRUNC('day', used_at)                    AS day,
       provider,
       COUNT(*) FILTER (WHERE status = 'ok')         AS calls_ok,
       COUNT(*) FILTER (WHERE status = 'failback')   AS calls_failback,
       COUNT(*) FILTER (WHERE status = 'error')      AS calls_error,
       COALESCE(SUM(total_tokens), 0)                AS total_tokens,
       COALESCE(ROUND(AVG(latency_ms)), 0)           AS avg_latency_ms
     FROM llm_usage_log
     WHERE used_at >= NOW() - ($1 || ' days')::INTERVAL
     GROUP BY day, provider
     ORDER BY day DESC, provider`,
    [safeDays]
  );

  return result.rows;
}

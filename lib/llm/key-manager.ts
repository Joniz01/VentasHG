import { pool } from "@/lib/db";
import { decryptKey } from "./llm-config";

export type ActiveKey = { id: number; decryptedKey: string };

/**
 * Retorna la primera API key activa para el proveedor que no haya superado su cuota.
 * Soporta múltiples keys por proveedor — rota entre ellas por orden de creación.
 */
export async function getActiveKey(provider: string): Promise<ActiveKey | null> {
  const result = await pool.query(
    `SELECT id, api_key, quota_limit, quota_used, quota_reset_at
     FROM llm_api_keys
     WHERE provider = $1 AND is_active = TRUE
     ORDER BY id ASC`,
    [provider]
  );

  for (const key of result.rows) {
    // Resetear cuota si ya venció el período
    if (key.quota_reset_at && new Date() > new Date(key.quota_reset_at)) {
      await pool.query(
        `UPDATE llm_api_keys
         SET quota_used = 0, quota_reset_at = NOW() + INTERVAL '1 day', updated_at = NOW()
         WHERE id = $1`,
        [key.id]
      );
      key.quota_used = 0;
    }

    // Saltar si cuota agotada
    if (key.quota_limit !== null && key.quota_used >= key.quota_limit) continue;

    return { id: key.id, decryptedKey: decryptKey(key.api_key) };
  }

  return null;
}

export async function incrementQuotaUsed(keyId: number, tokens: number): Promise<void> {
  await pool.query(
    `UPDATE llm_api_keys
     SET quota_used = quota_used + $1, updated_at = NOW()
     WHERE id = $2`,
    [tokens, keyId]
  );
}

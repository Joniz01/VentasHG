import crypto from "crypto";
import { pool } from "@/lib/db";

export const SESSION_COOKIE = "vhg_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const ADMIN_PASSWORD_KEY = "admin_password_hash";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = crypto.scryptSync(password, salt, hashBuffer.length);
  return crypto.timingSafeEqual(hashBuffer, candidate);
}

export async function getAdminPasswordHash(): Promise<string | null> {
  const result = await pool.query(
    `SELECT value FROM app_config WHERE key = $1`,
    [ADMIN_PASSWORD_KEY]
  );
  return result.rows[0]?.value ?? null;
}

export async function setAdminPassword(password: string): Promise<void> {
  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [ADMIN_PASSWORD_KEY, hashPassword(password)]
  );
}

export async function createSession(): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await pool.query(
    `INSERT INTO sesiones (token, expires_at) VALUES ($1, $2)`,
    [token, expiresAt]
  );

  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sesiones WHERE token = $1`, [token]);
}

export async function isSessionValid(token: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM sesiones WHERE token = $1 AND expires_at > now()`,
    [token]
  );
  return (result.rowCount ?? 0) > 0;
}

export const MOTORIZADO_SESSION_COOKIE = "vhg_motorizado_session";

export async function createMotorizadoSession(
  motorizadoId: number
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await pool.query(
    `INSERT INTO motorizado_sesiones (token, motorizado_id, expires_at) VALUES ($1, $2, $3)`,
    [token, motorizadoId, expiresAt]
  );

  return { token, expiresAt };
}

export async function deleteMotorizadoSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM motorizado_sesiones WHERE token = $1`, [token]);
}

export async function getMotorizadoIdFromSession(token: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT motorizado_id FROM motorizado_sesiones WHERE token = $1 AND expires_at > now()`,
    [token]
  );
  return result.rows[0]?.motorizado_id ?? null;
}

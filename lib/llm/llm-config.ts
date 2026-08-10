import crypto from "crypto";

const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.LLM_ENCRYPTION_KEY ?? "";
  if (key.length !== 32) {
    throw new Error("LLM_ENCRYPTION_KEY debe tener exactamente 32 caracteres");
  }
  return Buffer.from(key);
}

export function encryptKey(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptKey(stored: string): string {
  const [ivHex, encHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}

export const PROVIDER_TIMEOUTS: Record<string, number> = {
  gemini: parseInt(process.env.GEMINI_TIMEOUT_MS ?? "15000"),
  groq:   parseInt(process.env.GROQ_TIMEOUT_MS   ?? "10000"),
};

// Códigos HTTP que activan failback (400 excluido intencionalmente)
export const FAILBACK_HTTP_CODES = new Set([429, 500, 502, 503, 504]);

export const DEFAULT_MODELS: Record<string, string> = {
  gemini: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
  groq:   process.env.GROQ_MODEL   ?? "llama-3.1-8b-instant",
};

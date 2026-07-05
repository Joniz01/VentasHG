import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";
import { encryptKey } from "@/lib/llm/llm-config";

async function requireAdmin(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return null;
  return sesion;
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await pool.query(
      `SELECT id, provider, key_label, is_active,
              quota_limit, quota_used, quota_reset_at, created_at, updated_at
       FROM llm_api_keys
       ORDER BY provider, id`
    );
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json({ error: "Tabla llm_api_keys no existe — ejecutar migración 024" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const { provider, key_label, api_key, quota_limit } = body;

  if (!provider || !["gemini", "groq"].includes(provider)) {
    return NextResponse.json({ error: "provider debe ser 'gemini' o 'groq'" }, { status: 400 });
  }
  if (!key_label?.trim()) {
    return NextResponse.json({ error: "key_label es requerido" }, { status: 400 });
  }
  if (!api_key?.trim()) {
    return NextResponse.json({ error: "api_key es requerido" }, { status: 400 });
  }

  if (!process.env.LLM_ENCRYPTION_KEY || process.env.LLM_ENCRYPTION_KEY.length !== 32) {
    return NextResponse.json({ error: "LLM_ENCRYPTION_KEY no configurada (debe tener 32 caracteres)" }, { status: 503 });
  }

  const encrypted = encryptKey(api_key.trim());

  const result = await pool.query(
    `INSERT INTO llm_api_keys (provider, key_label, api_key, quota_limit, quota_reset_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
     RETURNING id, provider, key_label, is_active, quota_limit, quota_used`,
    [provider, key_label.trim(), encrypted, quota_limit ? Number(quota_limit) : null]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}

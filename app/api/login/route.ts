import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { SESSION_COOKIE, createUserSession, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { usuario?: string; clave?: string };
  const usuario = body.usuario?.trim() ?? "";
  const clave = body.clave ?? "";

  const result = await pool.query(
    `SELECT id, clave_hash FROM usuarios WHERE usuario = $1 AND activo = TRUE`,
    [usuario]
  );

  const row = result.rows[0];
  if (!row || !verifyPassword(clave, row.clave_hash)) {
    return NextResponse.json({ error: "Usuario o clave incorrectos" }, { status: 401 });
  }

  const { token, expiresAt } = await createUserSession(row.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

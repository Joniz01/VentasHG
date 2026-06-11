import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MOTORIZADO_SESSION_COOKIE, createMotorizadoSession, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { usuario?: string; clave?: string };
  const usuario = body.usuario?.trim() ?? "";
  const clave = body.clave ?? "";

  const result = await pool.query(
    `SELECT id, clave_hash FROM motorizados WHERE usuario = $1 AND activo = TRUE`,
    [usuario]
  );

  const motorizado = result.rows[0];
  if (!motorizado || !verifyPassword(clave, motorizado.clave_hash)) {
    return NextResponse.json({ error: "Usuario o clave incorrectos" }, { status: 401 });
  }

  const { token, expiresAt } = await createMotorizadoSession(motorizado.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(MOTORIZADO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

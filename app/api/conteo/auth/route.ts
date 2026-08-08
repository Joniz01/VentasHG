import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, createConteoSession, CONTEO_SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { usuario, clave } = await request.json();

  if (!usuario || !clave) {
    return NextResponse.json({ error: "Usuario y clave son requeridos" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT id, nombre, usuario, clave_hash, activo FROM conteo_usuarios WHERE usuario = $1`,
    [usuario]
  );

  const cu = result.rows[0];
  if (!cu || !cu.activo || !verifyPassword(clave, cu.clave_hash)) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  const { token, expiresAt } = await createConteoSession(cu.id);

  const response = NextResponse.json({
    conteoUsuario: { id: cu.id, nombre: cu.nombre, usuario: cu.usuario },
  });

  response.cookies.set(CONTEO_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return response;
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(CONTEO_SESSION_COOKIE)?.value;
  if (token) {
    const { deleteConteoSession } = await import("@/lib/auth");
    await deleteConteoSession(token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(CONTEO_SESSION_COOKIE);
  return response;
}

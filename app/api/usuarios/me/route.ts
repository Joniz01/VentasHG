import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest, hashPassword, verifyPassword } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  const newPassword = body.newPassword?.trim() ?? "";

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "La nueva contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const result = await pool.query(`SELECT clave_hash FROM usuarios WHERE id = $1`, [sesion.id]);
  const row = result.rows[0];
  if (!row || !verifyPassword(body.currentPassword ?? "", row.clave_hash)) {
    return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 401 });
  }

  await pool.query(`UPDATE usuarios SET clave_hash = $1 WHERE id = $2`, [
    hashPassword(newPassword),
    sesion.id,
  ]);

  return NextResponse.json({ ok: true });
}

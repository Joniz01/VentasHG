import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MOTORIZADO_SESSION_COOKIE, getMotorizadoIdFromSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MOTORIZADO_SESSION_COOKIE)?.value;
  const motorizadoId = token ? await getMotorizadoIdFromSession(token) : null;

  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT id, nombre, apellido, telefono, usuario, activo FROM motorizados WHERE id = $1`,
    [motorizadoId]
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    telefono: row.telefono,
    usuario: row.usuario,
    activo: row.activo,
  });
}

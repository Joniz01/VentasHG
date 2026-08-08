import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword, createMotorizadoSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { usuario, clave } = await request.json();

    if (!usuario || !clave) {
      return NextResponse.json({ error: "usuario y clave son requeridos" }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT id, nombre, apellido, clave_hash, activo FROM motorizados WHERE usuario = $1`,
      [usuario]
    );

    const motorizado = result.rows[0];
    if (!motorizado || !motorizado.activo) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const valid = verifyPassword(clave, motorizado.clave_hash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const { token } = await createMotorizadoSession(motorizado.id);

    return NextResponse.json({
      token,
      motorizado: {
        id: motorizado.id,
        nombre: motorizado.nombre,
        apellido: motorizado.apellido ?? null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/motorizado/auth]", msg);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

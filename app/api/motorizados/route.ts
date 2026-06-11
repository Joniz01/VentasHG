import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { MotorizadoInput } from "@/lib/types";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre, apellido, telefono, usuario, activo
     FROM motorizados
     ORDER BY nombre ASC`
  );

  const motorizados = result.rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    telefono: row.telefono,
    usuario: row.usuario,
    activo: row.activo,
  }));

  return NextResponse.json(motorizados);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as MotorizadoInput;

  if (!body.nombre?.trim() || !body.usuario?.trim() || !body.clave?.trim()) {
    return NextResponse.json(
      { error: "Nombre, usuario y clave son obligatorios" },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `INSERT INTO motorizados (nombre, apellido, telefono, usuario, clave_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        body.nombre.trim(),
        body.apellido?.trim() || null,
        body.telefono?.trim() || null,
        body.usuario.trim(),
        hashPassword(body.clave),
      ]
    );

    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "El usuario ya existe"
        : "Error al crear el motorizado";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

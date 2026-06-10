import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre FROM categorias ORDER BY nombre ASC`
  );

  return NextResponse.json(
    result.rows.map((row) => ({ id: row.id, nombre: row.nombre }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre } = body;

  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return NextResponse.json(
      { error: "El nombre de la categoría es obligatorio" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `INSERT INTO categorias (nombre)
     VALUES ($1)
     ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id, nombre`,
    [nombre.trim()]
  );

  const row = result.rows[0];

  return NextResponse.json({ id: row.id, nombre: row.nombre }, { status: 201 });
}

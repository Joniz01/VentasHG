import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre FROM extras_catalogo ORDER BY nombre ASC`
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
      { error: "El nombre del extra es obligatorio" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `INSERT INTO extras_catalogo (nombre)
     VALUES ($1)
     ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id, nombre`,
    [nombre.trim()]
  );

  const row = result.rows[0];

  return NextResponse.json({ id: row.id, nombre: row.nombre }, { status: 201 });
}

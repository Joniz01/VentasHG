import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  let result;
  try {
    result = await pool.query(
      `SELECT id, nombre, COALESCE(orden, 99) AS orden FROM categorias ORDER BY COALESCE(orden, 99) ASC, nombre ASC`
    );
  } catch {
    result = await pool.query(
      `SELECT id, nombre, 99 AS orden FROM categorias ORDER BY nombre ASC`
    );
  }

  return NextResponse.json(
    result.rows.map((row) => ({ id: row.id, nombre: row.nombre, orden: row.orden }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, orden } = body;

  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return NextResponse.json(
      { error: "El nombre de la categoría es obligatorio" },
      { status: 400 }
    );
  }

  const ordenNum = orden != null ? Number(orden) : 99;

  let row;
  try {
    const result = await pool.query(
      `INSERT INTO categorias (nombre, orden)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden
       RETURNING id, nombre, orden`,
      [nombre.trim(), ordenNum]
    );
    row = result.rows[0];
  } catch {
    const result = await pool.query(
      `INSERT INTO categorias (nombre)
       VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id, nombre, 99 AS orden`,
      [nombre.trim()]
    );
    row = result.rows[0];
  }

  return NextResponse.json({ id: row.id, nombre: row.nombre, orden: row.orden ?? 99 }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// "categorias" fue renombrada a "familias" en la migración.
// Este endpoint mantiene compatibilidad con el resto del código existente
// y además sirve a la UI nueva que usa familias.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const grupo = searchParams.get("grupo");
  const GRUPOS_VALIDOS = ["PARA_LA_VENTA", "MATERIA_PRIMA", "SERVICIO"];
  const grupoValido = grupo && GRUPOS_VALIDOS.includes(grupo) ? grupo : null;

  let result;
  try {
    result = await pool.query(
      `SELECT id, nombre, COALESCE(orden, 99) AS orden FROM familias
       WHERE ($1::text IS NULL AND (grupo IS NULL OR grupo = 'PARA_LA_VENTA'))
          OR ($1::text IS NOT NULL AND grupo = $1)
       ORDER BY COALESCE(orden, 99) ASC, nombre ASC`,
      [grupoValido]
    );
  } catch {
    result = await pool.query(
      `SELECT id, nombre, 99 AS orden FROM familias ORDER BY nombre ASC`
    );
  }

  return NextResponse.json(
    result.rows.map((row) => ({ id: row.id, nombre: row.nombre, orden: row.orden }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, orden, grupo } = body;

  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return NextResponse.json(
      { error: "El nombre de la familia es obligatorio" },
      { status: 400 }
    );
  }

  const ordenNum = orden != null ? Number(orden) : 99;
  const GRUPOS_VALIDOS = ["PARA_LA_VENTA", "MATERIA_PRIMA", "SERVICIO"];
  const grupoStr = grupo && GRUPOS_VALIDOS.includes(grupo) ? grupo : null;

  let row;
  try {
    const result = await pool.query(
      `INSERT INTO familias (nombre, orden, grupo)
       VALUES ($1, $2, $3)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden, grupo = EXCLUDED.grupo
       RETURNING id, nombre, orden, grupo`,
      [nombre.trim(), ordenNum, grupoStr]
    );
    row = result.rows[0];
  } catch {
    const result = await pool.query(
      `INSERT INTO familias (nombre)
       VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id, nombre, 99 AS orden, NULL AS grupo`,
      [nombre.trim()]
    );
    row = result.rows[0];
  }

  return NextResponse.json({ id: row.id, nombre: row.nombre, orden: row.orden ?? 99 }, { status: 201 });
}

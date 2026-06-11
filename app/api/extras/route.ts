import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT ec.id, ec.nombre,
            COALESCE(
              json_agg(DISTINCT pe.precio_adicional) FILTER (WHERE pe.precio_adicional IS NOT NULL),
              '[]'
            ) AS precios
     FROM extras_catalogo ec
     LEFT JOIN producto_extras pe ON pe.extra_id = ec.id
     GROUP BY ec.id, ec.nombre
     ORDER BY ec.nombre ASC`
  );

  return NextResponse.json(
    result.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      precios: (row.precios as (string | number)[])
        .map(Number)
        .sort((a, b) => a - b),
    }))
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

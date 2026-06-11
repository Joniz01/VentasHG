import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

const MIN_CHARS = 4;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < MIN_CHARS) {
    return NextResponse.json([]);
  }

  // Búsqueda por prefijo (case-insensitive) sobre nombre o cédula, usando
  // los índices lower(...) text_pattern_ops para que sea eficiente.
  const result = await pool.query(
    `SELECT id, nombre, cedula, direccion
     FROM clientes
     WHERE lower(nombre) LIKE lower($1) || '%'
        OR lower(cedula) LIKE lower($1) || '%'
     ORDER BY nombre
     LIMIT 10`,
    [q]
  );

  return NextResponse.json(
    result.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      cedula: row.cedula,
      direccion: row.direccion,
    }))
  );
}

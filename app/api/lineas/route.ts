import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const familiaId = searchParams.get("familiaId");

  const query = familiaId
    ? `SELECT id, familia_id, nombre FROM lineas WHERE activo = TRUE AND familia_id = $1 ORDER BY nombre ASC`
    : `SELECT id, familia_id, nombre FROM lineas WHERE activo = TRUE ORDER BY nombre ASC`;

  const result = familiaId
    ? await pool.query(query, [Number(familiaId)])
    : await pool.query(query);

  return NextResponse.json(
    result.rows.map((r) => ({ id: r.id, familiaId: r.familia_id, nombre: r.nombre }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, familiaId } = body;

  if (!nombre?.trim()) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  if (!familiaId) {
    return NextResponse.json({ error: "familiaId requerido" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO lineas (nombre, familia_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING id, familia_id, nombre`,
    [nombre.trim(), Number(familiaId)]
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Ya existe esa línea en esta familia" }, { status: 409 });
  }

  const row = result.rows[0];
  return NextResponse.json({ id: row.id, familiaId: row.familia_id, nombre: row.nombre }, { status: 201 });
}

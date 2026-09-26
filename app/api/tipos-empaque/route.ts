import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre, activo FROM tipos_empaque ORDER BY id ASC`
  );
  return NextResponse.json(result.rows);
}

export async function POST(request: NextRequest) {
  const { nombre } = await request.json();
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  const result = await pool.query(
    `INSERT INTO tipos_empaque (nombre) VALUES ($1) RETURNING id, nombre, activo`,
    [nombre.trim()]
  );
  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { id, nombre, activo } = await request.json();
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (nombre !== undefined) { sets.push(`nombre = $${vals.length + 1}`); vals.push(nombre.trim()); }
  if (activo !== undefined) { sets.push(`activo = $${vals.length + 1}`); vals.push(activo); }
  if (!sets.length) return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  vals.push(id);
  const result = await pool.query(
    `UPDATE tipos_empaque SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING id, nombre, activo`,
    vals
  );
  return NextResponse.json(result.rows[0]);
}

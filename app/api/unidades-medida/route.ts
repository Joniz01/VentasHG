import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre, abreviatura, tipo FROM unidades_medida ORDER BY tipo ASC, nombre ASC`
  );
  return NextResponse.json(
    result.rows.map((r) => ({ id: r.id, nombre: r.nombre, abreviatura: r.abreviatura, tipo: r.tipo }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, abreviatura, tipo } = body;

  const TIPOS_VALIDOS = ["UNIDAD", "MASA", "VOLUMEN", "LONGITUD"];
  if (!nombre?.trim() || !abreviatura?.trim() || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Nombre, abreviatura y tipo son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO unidades_medida (nombre, abreviatura, tipo) VALUES ($1, $2, $3)
       RETURNING id, nombre, abreviatura, tipo`,
      [nombre.trim(), abreviatura.trim(), tipo]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: `Ya existe una unidad con el nombre "${nombre.trim()}"` }, { status: 409 });
  }
}

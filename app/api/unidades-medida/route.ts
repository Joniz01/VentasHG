import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre, abreviatura, tipo FROM unidades_medida ORDER BY tipo ASC, nombre ASC`
  );
  return NextResponse.json(
    result.rows.map((r) => ({ id: r.id, nombre: r.nombre, abreviatura: r.abreviatura, tipo: r.tipo }))
  );
}

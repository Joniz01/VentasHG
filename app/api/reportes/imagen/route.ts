import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { data } = await req.json();
  if (!data || typeof data !== "string") {
    return NextResponse.json({ error: "data requerido" }, { status: 400 });
  }

  const id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  await pool.query(
    `INSERT INTO reporte_imagenes (id, data) VALUES ($1, $2)`,
    [id, data]
  );

  // Limpiar imágenes de más de 7 días
  await pool.query(`DELETE FROM reporte_imagenes WHERE created_at < NOW() - INTERVAL '7 days'`);

  return NextResponse.json({ id });
}

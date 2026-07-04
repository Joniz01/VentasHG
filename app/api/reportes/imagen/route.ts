import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { data, desde, hasta } = await req.json();
  if (!data || typeof data !== "string" || !desde || !hasta) {
    return NextResponse.json({ error: "data, desde y hasta son requeridos" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO reporte_imagenes (desde, hasta, data, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (desde, hasta) DO UPDATE SET data = $3, created_at = NOW()`,
    [desde, hasta, data]
  );

  // Eliminar imágenes de más de 7 días
  await pool.query(`DELETE FROM reporte_imagenes WHERE created_at < NOW() - INTERVAL '7 days'`);

  return NextResponse.json({ ok: true });
}

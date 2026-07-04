import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta) {
    return NextResponse.json({ error: "desde y hasta requeridos" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT data FROM reporte_imagenes WHERE desde = $1 AND hasta = $2`,
    [desde, hasta]
  );

  if (!result.rows[0]) return NextResponse.json({ data: null });
  return NextResponse.json({ data: result.rows[0].data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta) return NextResponse.json({ error: "desde y hasta requeridos" }, { status: 400 });
  await pool.query(`DELETE FROM reporte_imagenes WHERE desde = $1 AND hasta = $2`, [desde, hasta]);
  return NextResponse.json({ ok: true });
}

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

  // Leer días de retención desde configuración
  const configResult = await pool.query(
    `SELECT valor FROM configuracion WHERE clave = 'imagen_retencion_dias'`
  );
  const dias = parseInt(configResult.rows[0]?.valor ?? "7", 10);
  await pool.query(
    `DELETE FROM reporte_imagenes WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
    [dias]
  );

  return NextResponse.json({ ok: true });
}

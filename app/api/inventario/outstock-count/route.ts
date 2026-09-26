import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM productos
      WHERE activo = TRUE
        AND COALESCE(alerta_outstock_desactivada, FALSE) = FALSE
        AND COALESCE(stock_minimo, 0) > 0
        AND stock_actual < COALESCE(stock_minimo, 0)
        AND COALESCE(grupo, 'PARA_LA_VENTA') = 'PARA_LA_VENTA'
    `);
    return NextResponse.json({ count: result.rows[0]?.count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

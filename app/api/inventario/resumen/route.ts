import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    // Graceful: use stock_minimo/alerta_outstock_desactivada if migration 046 ran
    let result;
    try {
      result = await pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE activo AND tipo_producto = 'NORMAL'
              AND NOT COALESCE(alerta_outstock_desactivada, FALSE)
              AND stock_actual <= 0
          )::int AS en_cero,
          COUNT(*) FILTER (
            WHERE activo AND tipo_producto = 'NORMAL'
              AND NOT COALESCE(alerta_outstock_desactivada, FALSE)
              AND stock_actual > 0
              AND COALESCE(stock_minimo, 0) > 0
              AND stock_actual <= COALESCE(stock_minimo, 0)
          )::int AS bajo_minimo,
          COUNT(*) FILTER (
            WHERE activo AND tipo_producto = 'NORMAL'
              AND NOT COALESCE(alerta_outstock_desactivada, FALSE)
              AND stock_actual > 0
              AND (COALESCE(stock_minimo, 0) = 0 OR stock_actual > COALESCE(stock_minimo, 0))
          )::int AS saludable,
          COUNT(*) FILTER (
            WHERE activo AND tipo_producto = 'NORMAL'
              AND COALESCE(alerta_outstock_desactivada, FALSE)
          )::int AS sin_alerta
        FROM productos
      `);
    } catch {
      // Migration 046 not yet applied — fallback without new columns
      result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE activo AND tipo_producto = 'NORMAL' AND stock_actual <= 0)::int AS en_cero,
          0::int AS bajo_minimo,
          COUNT(*) FILTER (WHERE activo AND tipo_producto = 'NORMAL' AND stock_actual > 0)::int AS saludable,
          0::int AS sin_alerta
        FROM productos
      `);
    }

    const row = result.rows[0];
    return NextResponse.json({
      enCero:     row.en_cero,
      bajoMinimo: row.bajo_minimo,
      saludable:  row.saludable,
      sinAlerta:  row.sin_alerta,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/inventario/resumen]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

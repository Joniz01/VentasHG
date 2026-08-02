import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      WITH mes_actual AS (
        SELECT DATE_TRUNC('month', CURRENT_DATE) AS inicio
      ),
      entradas_mes AS (
        SELECT
          COUNT(*) AS cantidad,
          COALESCE(SUM(mi.cantidad * p.costo), 0) AS valor_usd
        FROM inventario_movimientos mi
        JOIN productos p ON p.id = mi.producto_id
        WHERE mi.tipo = 'ENTRADA'
          AND mi.created_at >= (SELECT inicio FROM mes_actual)
      ),
      movimientos_mes AS (
        SELECT COUNT(*) AS cantidad
        FROM inventario_movimientos
        WHERE tipo IN ('ENTRADA', 'AJUSTE')
          AND created_at >= (SELECT inicio FROM mes_actual)
      )
      SELECT
        (SELECT COUNT(*) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL' AND stock_actual > 0)::int AS productos_en_stock,
        (SELECT COALESCE(SUM(stock_actual * costo), 0) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL') AS valor_inventario,
        (SELECT COUNT(*) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL' AND stock_actual = 0)::int AS sin_stock,
        (SELECT COALESCE(SUM(stock_actual), 0) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL') AS unidades_totales,
        (SELECT valor_usd FROM entradas_mes) AS entradas_mes_usd,
        (SELECT cantidad FROM movimientos_mes)::int AS movimientos_mes
    `);

    const row = result.rows[0];
    return NextResponse.json({
      productosEnStock: row.productos_en_stock,
      valorInventario: Number(row.valor_inventario),
      sinStock: row.sin_stock,
      unidadesTotales: Number(row.unidades_totales),
      entradasMesUsd: Number(row.entradas_mes_usd),
      movimientosMes: row.movimientos_mes,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/inventarios/kpis]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

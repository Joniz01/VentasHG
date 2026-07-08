import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      WITH hoy AS (
        SELECT CURRENT_DATE AS fecha
      ),
      ventas_hoy AS (
        SELECT vi.producto_id, SUM(vi.cantidad) AS unidades
        FROM venta_items vi
        JOIN ventas v ON v.id = vi.venta_id
        WHERE v.fecha = (SELECT fecha FROM hoy)
        GROUP BY vi.producto_id
      ),
      top_producto AS (
        SELECT p.nombre, vh.unidades
        FROM ventas_hoy vh
        JOIN productos p ON p.id = vh.producto_id
        ORDER BY vh.unidades DESC
        LIMIT 1
      )
      SELECT
        (SELECT COUNT(*) FROM productos WHERE activo = TRUE)::int AS total_activos,
        (SELECT COALESCE(SUM(stock_actual * costo), 0) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL') AS valor_inventario,
        (SELECT COUNT(*) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL' AND stock_actual = 0)::int AS sin_stock,
        (SELECT COALESCE(SUM(unidades), 0) FROM ventas_hoy) AS unidades_hoy,
        (SELECT nombre FROM top_producto) AS top_producto_nombre,
        (SELECT unidades FROM top_producto) AS top_producto_unidades,
        (SELECT COALESCE(AVG(CASE WHEN precio_venta > 0 THEN (precio_venta - costo) / precio_venta * 100 ELSE 0 END), 0)
         FROM productos WHERE activo = TRUE) AS margen_promedio
    `);

    const row = result.rows[0];
    return NextResponse.json({
      totalActivos: row.total_activos,
      valorInventario: Number(row.valor_inventario),
      sinStock: row.sin_stock,
      unidadesHoy: Number(row.unidades_hoy),
      topProductoNombre: row.top_producto_nombre ?? null,
      topProductoUnidades: row.top_producto_unidades ? Number(row.top_producto_unidades) : null,
      margenPromedio: Number(row.margen_promedio),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/productos/kpis]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

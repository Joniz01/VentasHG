import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const grupo = searchParams.get("grupo"); // PARA_LA_VENTA | MATERIA_PRIMA | null (todos)

    const grupoFilter = grupo
      ? `AND COALESCE(grupo, 'PARA_LA_VENTA') = '${grupo === "MATERIA_PRIMA" ? "MATERIA_PRIMA" : "PARA_LA_VENTA"}'`
      : "";

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
        ${grupo === "MATERIA_PRIMA" ? "WHERE COALESCE(p.grupo, 'PARA_LA_VENTA') = 'MATERIA_PRIMA'" : grupo === "PARA_LA_VENTA" ? "WHERE COALESCE(p.grupo, 'PARA_LA_VENTA') = 'PARA_LA_VENTA'" : ""}
        ORDER BY vh.unidades DESC
        LIMIT 1
      )
      SELECT
        (SELECT COUNT(*) FROM productos WHERE activo = TRUE ${grupoFilter})::int AS total_activos,
        (SELECT COALESCE(SUM(stock_actual * costo), 0) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL' ${grupoFilter}) AS valor_inventario,
        (SELECT COUNT(*) FROM productos WHERE activo = TRUE AND tipo_producto = 'NORMAL' AND stock_actual = 0 ${grupoFilter})::int AS sin_stock,
        (SELECT COALESCE(SUM(unidades), 0) FROM ventas_hoy vh JOIN productos p ON p.id = vh.producto_id ${grupo ? `WHERE COALESCE(p.grupo, 'PARA_LA_VENTA') = '${grupo}'` : ""}) AS unidades_hoy,
        (SELECT nombre FROM top_producto) AS top_producto_nombre,
        (SELECT unidades FROM top_producto) AS top_producto_unidades,
        (SELECT COALESCE(AVG(CASE WHEN precio_venta > 0 THEN (precio_venta - costo) / precio_venta * 100 ELSE 0 END), 0)
         FROM productos WHERE activo = TRUE ${grupoFilter}) AS margen_promedio
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

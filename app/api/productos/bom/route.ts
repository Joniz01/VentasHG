import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET: productos con BOM (receta de producción)
export async function GET() {
  try {
    // Todos los productos para la venta o producción que tienen al menos un insumo en su RP
    const result = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        COALESCE(p.grupo, 'PARA_LA_VENTA') AS grupo,
        f.nombre AS categoria_nombre,
        COALESCE(p.rp_rendimiento, 1) AS rendimiento,
        COUNT(ri.id)::int AS total_insumos
      FROM productos p
      LEFT JOIN familias f ON f.id = p.categoria_id
      LEFT JOIN rp_items ri ON ri.producto_id = p.id AND ri.activo = TRUE
      WHERE p.activo = TRUE
        AND COALESCE(p.grupo, 'PARA_LA_VENTA') = 'PARA_LA_VENTA'
      GROUP BY p.id, p.nombre, p.grupo, f.nombre, p.rp_rendimiento
      ORDER BY f.nombre ASC NULLS LAST, p.nombre ASC
    `);

    // Insumos disponibles (MATERIA_PRIMA activos)
    const insumos = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        p.stock_actual
      FROM productos p
      WHERE p.activo = TRUE
        AND COALESCE(p.grupo, 'PARA_LA_VENTA') = 'MATERIA_PRIMA'
      ORDER BY p.nombre ASC
    `);

    return NextResponse.json({
      productos: result.rows,
      insumos: insumos.rows,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

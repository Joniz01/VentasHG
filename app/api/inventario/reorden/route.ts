import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.stock_actual,
        COALESCE(p.unidad_medida, 'unidad')  AS unidad_medida,
        COALESCE(p.grupo, 'PARA_LA_VENTA')   AS grupo,
        f.nombre                              AS categoria_nombre,
        p.stock_minimo,
        p.cantidad_reorden
      FROM productos p
      LEFT JOIN familias f ON f.id = p.categoria_id
      WHERE p.activo = TRUE
      ORDER BY
        CASE WHEN p.stock_actual <= p.stock_minimo AND p.stock_minimo > 0 THEN 0 ELSE 1 END,
        f.nombre ASC NULLS LAST,
        p.nombre ASC
    `);

    const productos = result.rows.map((r) => ({
      id:              r.id,
      nombre:          r.nombre,
      stockActual:     Number(r.stock_actual),
      unidadMedida:    r.unidad_medida,
      grupo:           r.grupo,
      categoriaNombre: r.categoria_nombre ?? null,
      stockMinimo:     r.stock_minimo !== null ? Number(r.stock_minimo) : 0,
      cantidadReorden: r.cantidad_reorden !== null ? Number(r.cantidad_reorden) : null,
    }));

    return NextResponse.json({ productos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

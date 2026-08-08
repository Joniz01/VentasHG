import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Público — sin auth — muestra productos Para la Venta con stock > 0
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT p.nombre, p.stock_actual, p.unidad_medida,
             c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.activo = TRUE
        AND COALESCE(p.grupo, 'PARA_LA_VENTA') = 'PARA_LA_VENTA'
        AND p.stock_actual > 0
        AND COALESCE(p.alerta_outstock_desactivada, FALSE) = FALSE
      ORDER BY COALESCE(c.orden, 99) ASC, c.nombre ASC NULLS LAST, p.nombre ASC
    `);

    const configRes = await pool.query(
      `SELECT valor FROM configuracion WHERE clave = 'nombre_empresa'`
    );
    const nombreEmpresa = configRes.rows[0]?.valor ?? "";

    return NextResponse.json({
      nombreEmpresa,
      productos: result.rows.map((r) => ({
        nombre: r.nombre,
        stockActual: Number(r.stock_actual),
        unidadMedida: r.unidad_medida ?? "unidad",
        categoriaNombre: r.categoria_nombre ?? null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

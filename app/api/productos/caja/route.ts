import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const revalidate = 0;

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.precio_venta,
        p.tipo_producto,
        p.variada_raciones,
        p.imagen_url,
        p.tipo_empaque_id,
        te.nombre AS tipo_empaque_nombre,
        c.nombre  AS categoria_nombre,
        COALESCE(c.orden, 99) AS cat_orden,
        (SELECT COUNT(*) FROM extras e WHERE e.producto_id = p.id AND e.activo = TRUE)::int AS extras_count
      FROM productos p
      LEFT JOIN familias   c  ON c.id  = p.categoria_id
      LEFT JOIN tipos_empaque te ON te.id = p.tipo_empaque_id
      WHERE p.activo = TRUE
        AND COALESCE(p.grupo, 'PARA_LA_VENTA') = 'PARA_LA_VENTA'
      ORDER BY COALESCE(c.orden, 99) ASC, c.nombre ASC NULLS LAST, p.nombre ASC
    `);

    const productos = result.rows.map((r) => ({
      id:               r.id as number,
      nombre:           r.nombre as string,
      precioVenta:      Number(r.precio_venta ?? 0),
      tipoProducto:     (r.tipo_producto as string) ?? "NORMAL",
      variadaRaciones:  Number(r.variada_raciones ?? 0),
      imagenUrl:        (r.imagen_url as string | null) ?? null,
      tipoEmpaqueId:    (r.tipo_empaque_id as number | null) ?? null,
      tipoEmpaqueNombre:(r.tipo_empaque_nombre as string | null) ?? null,
      categoriaNombre:  (r.categoria_nombre as string | null) ?? null,
      lineaNombre:      null,
      extrasCount:      r.extras_count as number,
      extras:           [] as { id: number; nombre: string; precioAdicional: number }[],
    }));

    return NextResponse.json(productos, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

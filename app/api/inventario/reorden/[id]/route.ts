import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();
  const stockMinimo    = body.stockMinimo    !== undefined ? Number(body.stockMinimo)    : null;
  const cantidadReorden = body.cantidadReorden !== undefined ? (body.cantidadReorden === null ? null : Number(body.cantidadReorden)) : undefined;

  if (stockMinimo === null || stockMinimo < 0) {
    return NextResponse.json({ error: "stock_minimo debe ser >= 0" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE productos
       SET stock_minimo     = $1,
           cantidad_reorden = $2
       WHERE id = $3 AND activo = TRUE
       RETURNING id, nombre, stock_actual, stock_minimo, cantidad_reorden`,
      [stockMinimo, cantidadReorden ?? null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, producto: result.rows[0] });
  } catch (err) {
    // Fallback si cantidad_reorden no existe aún
    try {
      const result = await pool.query(
        `UPDATE productos SET stock_minimo = $1 WHERE id = $2 AND activo = TRUE RETURNING id`,
        [stockMinimo, id]
      );
      if (result.rows.length === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err2) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}

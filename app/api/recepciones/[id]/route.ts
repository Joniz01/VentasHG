import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    const r = await pool.query(
      `SELECT r.*, json_agg(json_build_object('id',ri.id,'nombreProducto',ri.nombre_producto,'cantidad',ri.cantidad,'costoUnitBs',ri.costo_unit_bs,'productoId',ri.producto_id) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL) AS items
       FROM recepciones r LEFT JOIN recepcion_items ri ON ri.recepcion_id = r.id
       WHERE r.id = $1 GROUP BY r.id`, [id]
    );
    if (!r.rowCount) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    return NextResponse.json({ ...r.rows[0], items: r.rows[0].items ?? [] });
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  // Relacionar con una compra
  if (body.compraId !== undefined) {
    try {
      await pool.query(
        `UPDATE recepciones SET estado = CASE WHEN $1::int IS NULL THEN 'PENDIENTE' ELSE 'RELACIONADA' END, compra_id = $1 WHERE id = $2`,
        [body.compraId || null, id]
      );
      return NextResponse.json({ ok: true });
    } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }); }
  }
  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

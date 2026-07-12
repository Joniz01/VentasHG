import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const proveedorQ = searchParams.get("proveedor");
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (estado) { params.push(estado); conditions.push(`r.estado = $${params.length}`); }
  if (proveedorQ) { params.push(`%${proveedorQ}%`); conditions.push(`lower(r.proveedor_nombre) LIKE lower($${params.length})`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  try {
    const result = await pool.query(
      `SELECT r.id, r.fecha, r.proveedor_id, r.proveedor_nombre, r.estado, r.compra_id, r.observaciones, r.created_at,
              json_agg(json_build_object('id',ri.id,'nombreProducto',ri.nombre_producto,'cantidad',ri.cantidad,'costoUnitBs',ri.costo_unit_bs,'productoId',ri.producto_id) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL) AS items
       FROM recepciones r
       LEFT JOIN recepcion_items ri ON ri.recepcion_id = r.id
       ${where}
       GROUP BY r.id
       ORDER BY r.fecha DESC, r.id DESC`,
      params
    );
    return NextResponse.json({ items: result.rows.map(r => ({ ...r, items: r.items ?? [] })) });
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json();
  const { fecha, proveedorId, proveedorNombre, observaciones, items } = body;
  if (!proveedorNombre?.trim()) return NextResponse.json({ error: "Proveedor requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Debe agregar al menos un ítem" }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO recepciones (fecha, proveedor_id, proveedor_nombre, observaciones, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [fecha || new Date().toISOString().slice(0,10), proveedorId || null, proveedorNombre.trim(), observaciones?.trim() || null, sesion.id]
    );
    const recepcionId = r.rows[0].id;
    for (const it of items) {
      await client.query(
        `INSERT INTO recepcion_items (recepcion_id, producto_id, nombre_producto, cantidad, costo_unit_bs)
         VALUES ($1,$2,$3,$4,$5)`,
        [recepcionId, it.productoId || null, it.nombreProducto, Number(it.cantidad), it.costoUnitBs ? Number(it.costoUnitBs) : null]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ id: recepcionId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally { client.release(); }
}

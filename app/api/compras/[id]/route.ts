import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const cResult = await pool.query(
      `SELECT c.id, c.fecha, c.proveedor_id, c.proveedor_nombre, c.proveedor_rif,
              c.numero_factura, c.observaciones, c.tasa_dia, c.estado, c.anulada_at,
              c.imagen_factura, c.created_at
       FROM compras c WHERE c.id = $1`, [id]
    );
    if (!cResult.rowCount) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    const iResult = await pool.query(
      `SELECT ci.id, ci.producto_id, ci.nombre_producto, ci.cantidad, ci.costo_unit_bs, ci.subtotal_bs
       FROM compra_items ci WHERE ci.compra_id = $1 ORDER BY ci.id`, [id]
    );

    const c = cResult.rows[0];
    return NextResponse.json({
      id: c.id, fecha: c.fecha,
      proveedorId: c.proveedor_id, proveedorNombre: c.proveedor_nombre, proveedorRif: c.proveedor_rif,
      numeroFactura: c.numero_factura, observaciones: c.observaciones,
      tasaDia: Number(c.tasa_dia), estado: c.estado, anuladaAt: c.anulada_at,
      imagenFactura: c.imagen_factura, createdAt: c.created_at,
      items: iResult.rows.map((r) => ({
        id: r.id, productoId: r.producto_id, nombreProducto: r.nombre_producto,
        cantidad: Number(r.cantidad), costoUnitBs: Number(r.costo_unit_bs), subtotalBs: Number(r.subtotal_bs),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo ADMIN puede anular" }, { status: 403 });

  const body = await request.json();
  if (body.accion !== "anular") return NextResponse.json({ error: "Acción inválida" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cResult = await client.query(`SELECT estado FROM compras WHERE id = $1 FOR UPDATE`, [id]);
    if (!cResult.rowCount) throw new Error("Compra no encontrada");
    if (cResult.rows[0].estado === "ANULADA") throw new Error("La compra ya está anulada");

    await client.query(
      `UPDATE compras SET estado = 'ANULADA', anulada_at = now() WHERE id = $1`, [id]
    );

    // Revertir inventario
    const items = await client.query(
      `SELECT producto_id, cantidad, nombre_producto FROM compra_items WHERE compra_id = $1 AND producto_id IS NOT NULL`, [id]
    );
    for (const item of items.rows) {
      const pResult = await client.query(`SELECT stock_actual FROM productos WHERE id = $1 FOR UPDATE`, [item.producto_id]);
      if (pResult.rowCount && pResult.rowCount > 0) {
        const nuevoStock = Math.max(0, Number(pResult.rows[0].stock_actual) - Number(item.cantidad));
        await client.query(`UPDATE productos SET stock_actual = $1 WHERE id = $2`, [nuevoStock, item.producto_id]);
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota) VALUES ($1,'AJUSTE',$2,$3)`,
          [item.producto_id, -Number(item.cantidad), `Anulación Compra #${id}`]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  } finally {
    client.release();
  }
}

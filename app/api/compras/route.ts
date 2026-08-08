import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const proveedorQ = searchParams.get("proveedor");
  const estado = searchParams.get("estado");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (desde) { params.push(desde); conditions.push(`c.fecha >= $${params.length}`); }
  if (hasta) { params.push(hasta); conditions.push(`c.fecha <= $${params.length}`); }
  if (proveedorQ) { params.push(`%${proveedorQ}%`); conditions.push(`lower(c.proveedor_nombre) LIKE lower($${params.length})`); }
  if (estado) { params.push(estado); conditions.push(`c.estado = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const result = await pool.query(
      `SELECT c.id, c.fecha, c.proveedor_nombre, c.proveedor_rif, c.numero_factura,
              c.tasa_dia, c.estado, c.created_at,
              COALESCE(SUM(ci.subtotal_bs),0) AS total_bs
       FROM compras c
       LEFT JOIN compra_items ci ON ci.compra_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.fecha DESC, c.id DESC`,
      params
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      proveedorNombre: r.proveedor_nombre,
      proveedorRif: r.proveedor_rif,
      numeroFactura: r.numero_factura,
      tasaDia: Number(r.tasa_dia),
      estado: r.estado,
      totalBs: Number(r.total_bs),
      totalUsd: r.tasa_dia > 0 ? Number(r.total_bs) / Number(r.tasa_dia) : 0,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { fecha, proveedorNombre, proveedorRif, proveedorId, numeroFactura, observaciones, tasaDia, items, imagenFactura, fechaVencimientoPago } = body;

  if (!proveedorNombre?.trim()) return NextResponse.json({ error: "Proveedor requerido" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Debe agregar al menos un ítem" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cResult = await client.query(
      `INSERT INTO compras (fecha, proveedor_id, proveedor_nombre, proveedor_rif, numero_factura, observaciones, tasa_dia, imagen_factura, fecha_vencimiento_pago, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [fecha || new Date().toISOString().slice(0,10), proveedorId || null,
       proveedorNombre.trim(), proveedorRif?.trim() || null,
       numeroFactura?.trim() || null, observaciones?.trim() || null,
       Number(tasaDia) || 0, imagenFactura || null, fechaVencimientoPago?.trim() || null, sesion.id]
    );
    const compraId = cResult.rows[0].id;

    for (const item of items) {
      const cantidad = Number(item.cantidad);
      const costoUnit = Number(item.costoUnitBs);
      const subtotal = cantidad * costoUnit;

      await client.query(
        `INSERT INTO compra_items (compra_id, producto_id, nombre_producto, cantidad, costo_unit_bs, subtotal_bs)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [compraId, item.productoId || null, item.nombreProducto, cantidad, costoUnit, subtotal]
      );

      // Impactar inventario si hay producto_id
      if (item.productoId) {
        const pResult = await client.query(
          `SELECT stock_actual FROM productos WHERE id = $1 FOR UPDATE`, [item.productoId]
        );
        if (pResult.rowCount && pResult.rowCount > 0) {
          const nuevoStock = Number(pResult.rows[0].stock_actual) + cantidad;
          await client.query(`UPDATE productos SET stock_actual = $1 WHERE id = $2`, [nuevoStock, item.productoId]);
          await client.query(
            `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
             VALUES ($1,'ENTRADA',$2,$3)`,
            [item.productoId, cantidad, `Compra #${compraId} — ${proveedorNombre}`]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ id: compraId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}

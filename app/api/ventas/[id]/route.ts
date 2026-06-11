import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  guardarCliente,
  insertarItemsYPagos,
  resolveDeliveryAsignado,
  revertirInventarioVenta,
  validarVenta,
  type VentaBody,
} from "@/lib/ventas";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as VentaBody;

  const error = validarVenta(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const deliveryAsignado = body.despachoPendiente
      ? await resolveDeliveryAsignado(client, body)
      : null;

    const ventaResult = await client.query(
      `UPDATE ventas
       SET fecha = $1, tasa_dia = $2, cliente = $3, cliente_ci = $4, direccion = $5,
           modalidad_compra = $6, modo_entrega = $7, costo_delivery = $8, observaciones = $9,
           despacho_pendiente = $10, hora_entrega = $11, hora_preparacion = $12, delivery_asignado = $13,
           motorizado_id = $14
       WHERE id = $15
       RETURNING id`,
      [
        body.fecha,
        Number(body.tasaDelDia),
        body.cliente,
        body.clienteCi || null,
        body.direccion || null,
        body.modalidadCompra || null,
        body.modoEntrega || "LOCAL",
        Number(body.costoDelivery),
        body.observaciones || null,
        Boolean(body.despachoPendiente),
        body.despachoPendiente ? body.horaEntrega : null,
        body.despachoPendiente ? body.horaPreparacion : null,
        deliveryAsignado,
        body.despachoPendiente ? body.motorizadoId || null : null,
        id,
      ]
    );

    if (ventaResult.rowCount === 0) {
      throw new Error("Venta no encontrada");
    }

    await revertirInventarioVenta(client, Number(id));

    await client.query(`DELETE FROM venta_items WHERE venta_id = $1`, [id]);
    await client.query(`DELETE FROM pagos_venta WHERE venta_id = $1`, [id]);

    await guardarCliente(client, body);
    await insertarItemsYPagos(client, Number(id), body);

    await client.query("COMMIT");

    return NextResponse.json({ id: Number(id) });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al actualizar la venta";
    const status = message === "Venta no encontrada" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await revertirInventarioVenta(client, Number(id));

    const result = await client.query(`DELETE FROM ventas WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      throw new Error("Venta no encontrada");
    }

    await client.query("COMMIT");

    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al eliminar la venta";
    const status = message === "Venta no encontrada" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  } finally {
    client.release();
  }
}

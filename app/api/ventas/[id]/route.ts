import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  guardarCliente,
  insertarItemsYPagos,
  resolveDeliveryAsignado,
  revertirInventarioVenta,
  toTitleCase,
  validarVenta,
  type VentaBody,
} from "@/lib/ventas";
import { notificarNuevoPedido } from "@/lib/fcm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const ventaResult = await pool.query(
    `SELECT v.id, v.fecha, v.tasa_dia, v.cliente, v.cliente_ci, v.cliente_telefono,
            v.direccion, v.modalidad_compra, v.modo_entrega, v.tipo_delivery,
            v.costo_delivery, v.descuento_porcentaje, v.observaciones,
            v.despacho_pendiente, v.hora_entrega, v.hora_preparacion, v.hora_retiro,
            v.delivery_asignado, v.cuenta_por_cobrar, v.cuenta_cobrada,
            v.cuenta_cobrada_at, v.fecha_limite_pago,
            m.nombre AS motorizado_nombre
     FROM ventas v
     LEFT JOIN motorizados m ON m.id = v.motorizado_id
     WHERE v.id = $1`,
    [id]
  );

  if (ventaResult.rowCount === 0) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  const venta = ventaResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT vi.cantidad, vi.precio_unit, vi.costo_unit, p.nombre AS producto,
            e.nombre AS extra
     FROM venta_items vi
     JOIN productos p ON p.id = vi.producto_id
     LEFT JOIN productos e ON e.id = vi.extra_id
     WHERE vi.venta_id = $1
     ORDER BY vi.id`,
    [id]
  );

  const pagosResult = await pool.query(
    `SELECT metodo, monto, COALESCE(fecha_pago, $2) AS fecha_pago
     FROM pagos_venta
     WHERE venta_id = $1
     ORDER BY id`,
    [id, venta.fecha]
  );

  return NextResponse.json({
    venta: {
      id: venta.id,
      fecha: venta.fecha,
      tasaDia: Number(venta.tasa_dia),
      cliente: venta.cliente,
      clienteCi: venta.cliente_ci,
      clienteTelefono: venta.cliente_telefono,
      direccion: venta.direccion,
      modalidadCompra: venta.modalidad_compra,
      modoEntrega: venta.modo_entrega,
      tipoDelivery: venta.tipo_delivery,
      costoDelivery: Number(venta.costo_delivery),
      descuentoPorcentaje: Number(venta.descuento_porcentaje),
      observaciones: venta.observaciones,
      despachoPendiente: venta.despacho_pendiente,
      horaEntrega: venta.hora_entrega,
      horaPreparacion: venta.hora_preparacion,
      horaRetiro: venta.hora_retiro,
      deliveryAsignado: venta.delivery_asignado,
      motorizadoNombre: venta.motorizado_nombre,
      cuentaPorCobrar: venta.cuenta_por_cobrar,
      cuentaCobrada: venta.cuenta_cobrada,
      cuentaCobradaAt: venta.cuenta_cobrada_at,
      fechaLimitePago: venta.fecha_limite_pago,
    },
    items: itemsResult.rows.map((r) => ({
      producto: r.producto,
      extra: r.extra,
      cantidad: Number(r.cantidad),
      precioUnit: Number(r.precio_unit),
      costoUnit: Number(r.costo_unit),
    })),
    pagos: pagosResult.rows.map((r) => ({
      metodo: r.metodo,
      monto: Number(r.monto),
      fechaPago: r.fecha_pago,
    })),
  });
}

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

    body.cliente = toTitleCase(body.cliente);

    // Motorizado anterior para detectar cambio de asignación
    const prevResult = await client.query(
      `SELECT motorizado_id FROM ventas WHERE id = $1`,
      [id]
    );
    const prevMotorizadoId = prevResult.rows[0]?.motorizado_id ?? null;

    const deliveryAsignado = body.despachoPendiente
      ? await resolveDeliveryAsignado(client, body)
      : null;

    const cuentaPorCobrar = !body.pagos || body.pagos.length === 0;

    const ventaResult = await client.query(
      `UPDATE ventas
       SET fecha = $1, tasa_dia = $2, cliente = $3, cliente_ci = $4, cliente_telefono = $5, direccion = $6,
           modalidad_compra = $7, modo_entrega = $8, tipo_delivery = $9, costo_delivery = $10,
           descuento_porcentaje = $11, observaciones = $12,
           despacho_pendiente = $13, hora_entrega = $14, hora_preparacion = $15, hora_retiro = $16,
           delivery_asignado = $17, motorizado_id = $18, cuenta_por_cobrar = $19, fecha_limite_pago = $20,
           cuenta_cobrada = CASE WHEN $19 THEN cuenta_cobrada ELSE FALSE END,
           cuenta_cobrada_at = CASE WHEN $19 THEN cuenta_cobrada_at ELSE NULL END
       WHERE id = $21
       RETURNING id`,
      [
        body.fecha,
        Number(body.tasaDelDia),
        body.cliente,
        body.clienteCi || null,
        body.clienteTelefono || null,
        body.direccion || null,
        body.modalidadCompra || null,
        body.modoEntrega || "DELIVERY",
        body.modoEntrega === "DELIVERY" ? body.tipoDelivery || null : null,
        Number(body.costoDelivery),
        Number(body.descuentoPorcentaje) || 0,
        body.observaciones || null,
        Boolean(body.despachoPendiente),
        body.despachoPendiente ? body.horaEntrega : null,
        body.despachoPendiente ? body.horaPreparacion : null,
        body.despachoPendiente ? body.horaRetiro : null,
        deliveryAsignado,
        body.despachoPendiente ? body.motorizadoId || null : null,
        cuentaPorCobrar,
        cuentaPorCobrar ? body.fechaLimitePago || null : null,
        id,
      ]
    );

    if (ventaResult.rowCount === 0) {
      throw new Error("Venta no encontrada");
    }

    await revertirInventarioVenta(client, Number(id));

    await client.query(`DELETE FROM venta_items WHERE venta_id = $1`, [id]);
    await client.query(`DELETE FROM pagos_venta WHERE venta_id = $1`, [id]);
    await client.query(`DELETE FROM cashea_pagos WHERE venta_id = $1`, [id]);

    await guardarCliente(client, body);
    await insertarItemsYPagos(client, Number(id), body);

    await client.query("COMMIT");

    const nuevoMotorizadoId = body.despachoPendiente ? (body.motorizadoId || null) : null;
    // Notificar al nuevo motorizado si cambió la asignación
    if (nuevoMotorizadoId && nuevoMotorizadoId !== prevMotorizadoId) {
      notificarNuevoPedido(nuevoMotorizadoId, Number(id), body.cliente).catch(() => {});
    }

    return NextResponse.json({ id: Number(id) });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al actualizar la venta";
    const status = message === "Venta no encontrada" ? 404 : 400;
    const detail = (err as Record<string, unknown>)?.detail ?? null;
    const hint = (err as Record<string, unknown>)?.hint ?? null;
    const where = (err as Record<string, unknown>)?.where ?? null;
    const table = (err as Record<string, unknown>)?.table ?? null;
    console.error("[PUT /api/ventas/:id]", { message, detail, hint, where, table, err });
    return NextResponse.json({ error: message, detail, hint, where, table }, { status });
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

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  guardarCliente,
  insertarItemsYPagos,
  resolveDeliveryAsignado,
  validarVenta,
  type VentaBody,
} from "@/lib/ventas";

export async function GET() {
  const ventasResult = await pool.query(
    `SELECT id, fecha, tasa_dia, cliente, cliente_ci, direccion, modalidad_compra, modo_entrega,
            costo_delivery, observaciones, despacho_pendiente, hora_entrega, hora_preparacion,
            delivery_asignado, motorizado_id, pedido_entregado, pedido_enviado, created_at
     FROM ventas
     ORDER BY fecha DESC, id DESC`
  );

  const ventaIds = ventasResult.rows.map((row) => row.id);

  const itemsResult = ventaIds.length
    ? await pool.query(
        `SELECT vi.id, vi.venta_id, vi.producto_id, vi.cantidad, vi.costo_unit, vi.precio_unit,
                vi.extra_id, vi.extra_nombre, vi.extra_precio,
                p.nombre AS nombre_producto
         FROM venta_items vi
         JOIN productos p ON p.id = vi.producto_id
         WHERE vi.venta_id = ANY($1::int[])`,
        [ventaIds]
      )
    : { rows: [] };

  const pagosResult = ventaIds.length
    ? await pool.query(
        `SELECT id, venta_id, metodo, monto
         FROM pagos_venta
         WHERE venta_id = ANY($1::int[])`,
        [ventaIds]
      )
    : { rows: [] };

  const variadaResult = ventaIds.length
    ? await pool.query(
        `SELECT viv.venta_item_id, viv.producto_id, viv.cantidad, p.nombre AS nombre_producto
         FROM venta_item_variada viv
         JOIN venta_items vi ON vi.id = viv.venta_item_id
         JOIN productos p ON p.id = viv.producto_id
         WHERE vi.venta_id = ANY($1::int[])`,
        [ventaIds]
      )
    : { rows: [] };

  const ventas = ventasResult.rows.map((row) => ({
    id: row.id,
    fecha: row.fecha,
    tasaDelDia: Number(row.tasa_dia),
    cliente: row.cliente,
    clienteCi: row.cliente_ci,
    direccion: row.direccion,
    modalidadCompra: row.modalidad_compra,
    modoEntrega: row.modo_entrega,
    costoDelivery: Number(row.costo_delivery),
    observaciones: row.observaciones,
    despachoPendiente: row.despacho_pendiente,
    horaEntrega: row.hora_entrega,
    horaPreparacion: row.hora_preparacion,
    deliveryAsignado: row.delivery_asignado,
    motorizadoId: row.motorizado_id,
    pedidoEntregado: row.pedido_entregado,
    pedidoEnviado: row.pedido_enviado,
    createdAt: row.created_at,
    items: itemsResult.rows
      .filter((item) => item.venta_id === row.id)
      .map((item) => ({
        id: item.id,
        productoId: item.producto_id,
        nombreProducto: item.nombre_producto,
        cantidad: Number(item.cantidad),
        costoUnit: Number(item.costo_unit),
        precioUnit: Number(item.precio_unit),
        extraId: item.extra_id,
        extraNombre: item.extra_nombre,
        extraPrecio: Number(item.extra_precio),
        variadaSelecciones: variadaResult.rows
          .filter((v) => v.venta_item_id === item.id)
          .map((v) => ({
            productoId: v.producto_id,
            nombreProducto: v.nombre_producto,
            cantidad: Number(v.cantidad),
          })),
      })),
    pagos: pagosResult.rows
      .filter((pago) => pago.venta_id === row.id)
      .map((pago) => ({
        id: pago.id,
        metodo: pago.metodo,
        monto: Number(pago.monto),
      })),
  }));

  return NextResponse.json(ventas);
}

export async function POST(request: NextRequest) {
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
      `INSERT INTO ventas (fecha, tasa_dia, cliente, cliente_ci, direccion, modalidad_compra, modo_entrega, costo_delivery, observaciones, despacho_pendiente, hora_entrega, hora_preparacion, delivery_asignado, motorizado_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      ]
    );

    const ventaId = ventaResult.rows[0].id;

    await guardarCliente(client, body);
    await insertarItemsYPagos(client, ventaId, body);

    await client.query("COMMIT");

    return NextResponse.json({ id: ventaId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al registrar la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

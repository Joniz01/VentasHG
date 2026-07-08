import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getMotorizadoIdFromRequest } from "@/lib/motorizado-auth";

export async function GET(request: NextRequest) {
  const motorizadoId = await getMotorizadoIdFromRequest(request);
  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ventasResult = await pool.query(
    `SELECT id, cliente, cliente_telefono, direccion, delivery_asignado,
            hora_entrega, hora_preparacion, hora_retiro,
            pedido_aceptado, pedido_entregado, pedido_enviado, fecha
     FROM ventas
     WHERE despacho_pendiente = TRUE
       AND motorizado_id = $1
       AND (pedido_entregado = FALSE OR fecha = CURRENT_DATE)
     ORDER BY pedido_entregado ASC, hora_entrega ASC NULLS LAST, id ASC`,
    [motorizadoId]
  );

  const ventaIds = ventasResult.rows.map((r) => r.id);

  const itemsResult = ventaIds.length
    ? await pool.query(
        `SELECT vi.venta_id, vi.cantidad, vi.extra_nombre, p.nombre AS nombre_producto
         FROM venta_items vi
         JOIN productos p ON p.id = vi.producto_id
         WHERE vi.venta_id = ANY($1::int[])`,
        [ventaIds]
      )
    : { rows: [] };

  const pedidos = ventasResult.rows.map((row) => {
    const items = itemsResult.rows
      .filter((it) => it.venta_id === row.id)
      .map((it) => ({
        nombreProducto: it.nombre_producto,
        cantidad: Number(it.cantidad),
        extraNombre: it.extra_nombre ?? null,
      }));

    return {
      id: row.id,
      cliente: row.cliente,
      clienteTelefono: row.cliente_telefono ?? null,
      direccion: row.direccion ?? null,
      deliveryAsignado: row.delivery_asignado ?? null,
      horaEntrega: row.hora_entrega ?? null,
      horaPreparacion: row.hora_preparacion ?? null,
      horaRetiro: row.hora_retiro ?? null,
      pedidoAceptado: row.pedido_aceptado,
      pedidoEntregado: row.pedido_entregado,
      pedidoEnviado: row.pedido_enviado,
      fecha: row.fecha,
      items,
    };
  });

  return NextResponse.json(pedidos);
}

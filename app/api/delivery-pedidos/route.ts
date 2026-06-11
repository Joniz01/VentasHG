import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MOTORIZADO_SESSION_COOKIE, getMotorizadoIdFromSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MOTORIZADO_SESSION_COOKIE)?.value;
  const motorizadoId = token ? await getMotorizadoIdFromSession(token) : null;

  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ventasResult = await pool.query(
    `SELECT id, cliente, direccion, delivery_asignado, motorizado_id, hora_entrega, hora_preparacion, pedido_entregado, pedido_enviado
     FROM ventas
     WHERE despacho_pendiente = TRUE
       AND motorizado_id = $1
       AND (pedido_entregado = FALSE OR fecha = CURRENT_DATE)
     ORDER BY pedido_entregado ASC, hora_entrega ASC NULLS LAST, id ASC`,
    [motorizadoId]
  );

  const ventaIds = ventasResult.rows.map((row) => row.id);

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
      .filter((item) => item.venta_id === row.id)
      .map((item) => ({
        nombreProducto: item.nombre_producto,
        cantidad: Number(item.cantidad),
        extraNombre: item.extra_nombre,
      }));

    const tieneFrito = items.some((item) => item.extraNombre === "Frito");
    const tieneCongelado = items.some((item) => item.extraNombre !== "Frito");
    const fritoCongelado =
      tieneFrito && tieneCongelado
        ? "Frito y Congelado"
        : tieneFrito
          ? "Frito"
          : "Congelado";

    return {
      id: row.id,
      cliente: row.cliente,
      direccion: row.direccion,
      deliveryAsignado: row.delivery_asignado,
      motorizadoId: row.motorizado_id,
      horaEntrega: row.hora_entrega,
      horaPreparacion: row.hora_preparacion,
      pedidoEntregado: row.pedido_entregado,
      pedidoEnviado: row.pedido_enviado,
      fritoCongelado,
      items,
    };
  });

  return NextResponse.json(pedidos);
}

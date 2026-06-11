import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const ventasResult = await pool.query(
    `SELECT id, cliente, direccion, delivery_asignado, hora_entrega, hora_preparacion, pedido_entregado
     FROM ventas
     WHERE despacho_pendiente = TRUE
       AND (pedido_entregado = FALSE OR fecha = CURRENT_DATE)
     ORDER BY pedido_entregado ASC, hora_entrega ASC NULLS LAST, id ASC`
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
      horaEntrega: row.hora_entrega,
      horaPreparacion: row.hora_preparacion,
      pedidoEntregado: row.pedido_entregado,
      fritoCongelado,
      items,
    };
  });

  return NextResponse.json(pedidos);
}

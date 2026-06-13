import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const ventasResult = await pool.query(
    `SELECT id, cliente, cliente_ci, cliente_telefono, direccion, fecha_limite_pago
     FROM ventas
     WHERE cuenta_por_cobrar = TRUE AND cuenta_cobrada = FALSE
     ORDER BY id DESC`
  );

  const ventaIds = ventasResult.rows.map((row) => row.id);

  const itemsResult = ventaIds.length
    ? await pool.query(
        `SELECT vi.venta_id, vi.cantidad, vi.precio_unit, vi.extra_nombre, p.nombre AS nombre_producto
         FROM venta_items vi
         JOIN productos p ON p.id = vi.producto_id
         WHERE vi.venta_id = ANY($1::int[])
         ORDER BY vi.id ASC`,
        [ventaIds]
      )
    : { rows: [] };

  const pedidos = ventasResult.rows.map((row) => ({
    id: row.id,
    cliente: row.cliente,
    clienteCi: row.cliente_ci,
    clienteTelefono: row.cliente_telefono,
    direccion: row.direccion,
    fechaLimitePago: row.fecha_limite_pago,
    items: itemsResult.rows
      .filter((item) => item.venta_id === row.id)
      .map((item) => ({
        descripcion: item.extra_nombre
          ? `${item.nombre_producto} (${item.extra_nombre})`
          : item.nombre_producto,
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precio_unit),
      })),
  }));

  return NextResponse.json(pedidos);
}

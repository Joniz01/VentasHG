import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { METODOS_PAGO, MODOS_ENTREGA } from "@/lib/types";

export async function GET() {
  const ventasResult = await pool.query(
    `SELECT id, fecha, tasa_dia, cliente, modalidad_compra, modo_entrega,
            costo_delivery, observaciones, created_at
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

  const ventas = ventasResult.rows.map((row) => ({
    id: row.id,
    fecha: row.fecha,
    tasaDelDia: Number(row.tasa_dia),
    cliente: row.cliente,
    modalidadCompra: row.modalidad_compra,
    modoEntrega: row.modo_entrega,
    costoDelivery: Number(row.costo_delivery),
    observaciones: row.observaciones,
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
  const body = await request.json();
  const {
    fecha,
    tasaDelDia,
    cliente,
    modalidadCompra,
    modoEntrega,
    costoDelivery,
    observaciones,
    items,
    pagos,
  } = body;

  if (!fecha || !cliente || typeof cliente !== "string") {
    return NextResponse.json(
      { error: "Fecha y cliente son obligatorios" },
      { status: 400 }
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Debes agregar al menos un producto" },
      { status: 400 }
    );
  }

  if (modoEntrega && !MODOS_ENTREGA.includes(modoEntrega)) {
    return NextResponse.json({ error: "Modo de entrega inválido" }, { status: 400 });
  }

  for (const pago of pagos ?? []) {
    if (!METODOS_PAGO.includes(pago.metodo)) {
      return NextResponse.json(
        { error: `Método de pago inválido: ${pago.metodo}` },
        { status: 400 }
      );
    }
  }

  const tasaNum = Number(tasaDelDia);
  const costoDeliveryNum = Number(costoDelivery ?? 0);

  if (Number.isNaN(tasaNum) || Number.isNaN(costoDeliveryNum)) {
    return NextResponse.json({ error: "Datos numéricos inválidos" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ventaResult = await client.query(
      `INSERT INTO ventas (fecha, tasa_dia, cliente, modalidad_compra, modo_entrega, costo_delivery, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        fecha,
        tasaNum,
        cliente,
        modalidadCompra || null,
        modoEntrega || "LOCAL",
        costoDeliveryNum,
        observaciones || null,
      ]
    );

    const ventaId = ventaResult.rows[0].id;

    for (const item of items) {
      const productoResult = await client.query(
        `SELECT costo, precio_venta FROM productos WHERE id = $1`,
        [item.productoId]
      );

      if (productoResult.rowCount === 0) {
        throw new Error(`Producto ${item.productoId} no encontrado`);
      }

      const cantidadNum = Number(item.cantidad);
      if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
        throw new Error("Cantidad inválida");
      }

      const { costo, precio_venta } = productoResult.rows[0];

      let extraId: number | null = null;
      let extraNombre: string | null = null;
      let extraPrecio = 0;

      if (item.extraId) {
        const extraResult = await client.query(
          `SELECT pe.id, ec.nombre, pe.precio_adicional
           FROM producto_extras pe
           JOIN extras_catalogo ec ON ec.id = pe.extra_id
           WHERE pe.id = $1 AND pe.producto_id = $2`,
          [item.extraId, item.productoId]
        );

        if (extraResult.rowCount === 0) {
          throw new Error(`Extra ${item.extraId} no encontrado para el producto`);
        }

        extraId = extraResult.rows[0].id;
        extraNombre = extraResult.rows[0].nombre;
        extraPrecio = Number(extraResult.rows[0].precio_adicional);
      }

      const precioUnit = Number(precio_venta) + extraPrecio;

      await client.query(
        `INSERT INTO venta_items (venta_id, producto_id, cantidad, costo_unit, precio_unit, extra_id, extra_nombre, extra_precio)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [ventaId, item.productoId, cantidadNum, costo, precioUnit, extraId, extraNombre, extraPrecio]
      );
    }

    for (const pago of pagos ?? []) {
      const montoNum = Number(pago.monto);
      if (Number.isNaN(montoNum) || montoNum <= 0) continue;

      await client.query(
        `INSERT INTO pagos_venta (venta_id, metodo, monto)
         VALUES ($1, $2, $3)`,
        [ventaId, pago.metodo, montoNum]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ id: ventaId }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Error al registrar la venta";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

import type { PoolClient } from "pg";
import { METODOS_PAGO, MODOS_ENTREGA } from "@/lib/types";

export type VentaBody = {
  fecha: string;
  tasaDelDia: number;
  cliente: string;
  clienteCi?: string | null;
  direccion?: string | null;
  modalidadCompra?: string | null;
  modoEntrega?: string | null;
  costoDelivery: number;
  observaciones?: string | null;
  items: { productoId: number; cantidad: number; extraId?: number | null }[];
  pagos?: { metodo: string; monto: number }[];
};

export function validarVenta(body: VentaBody): string | null {
  if (!body.fecha || !body.cliente || typeof body.cliente !== "string") {
    return "Fecha y cliente son obligatorios";
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return "Debes agregar al menos un producto";
  }

  if (body.modoEntrega && !MODOS_ENTREGA.includes(body.modoEntrega as (typeof MODOS_ENTREGA)[number])) {
    return "Modo de entrega inválido";
  }

  for (const pago of body.pagos ?? []) {
    if (!METODOS_PAGO.includes(pago.metodo as (typeof METODOS_PAGO)[number])) {
      return `Método de pago inválido: ${pago.metodo}`;
    }
  }

  if (Number.isNaN(Number(body.tasaDelDia)) || Number.isNaN(Number(body.costoDelivery))) {
    return "Datos numéricos inválidos";
  }

  return null;
}

export async function insertarItemsYPagos(
  client: PoolClient,
  ventaId: number,
  body: VentaBody
) {
  for (const item of body.items) {
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

  for (const pago of body.pagos ?? []) {
    const montoNum = Number(pago.monto);
    if (Number.isNaN(montoNum) || montoNum <= 0) continue;

    await client.query(
      `INSERT INTO pagos_venta (venta_id, metodo, monto)
       VALUES ($1, $2, $3)`,
      [ventaId, pago.metodo, montoNum]
    );
  }
}

import type { PoolClient } from "pg";
import { METODOS_PAGO, MODOS_ENTREGA } from "@/lib/types";
import { validarTelefono } from "@/lib/validacion";

export type VentaBody = {
  fecha: string;
  tasaDelDia: number;
  cliente: string;
  clienteNombre?: string;
  clienteApellido?: string;
  clienteCi?: string | null;
  clienteTelefono?: string | null;
  direccion?: string | null;
  modalidadCompra?: string | null;
  modoEntrega?: string | null;
  costoDelivery: number;
  observaciones?: string | null;
  despachoPendiente?: boolean;
  horaEntrega?: string | null;
  horaPreparacion?: string | null;
  horaRetiro?: string | null;
  deliveryAsignado?: string | null;
  motorizadoId?: number | null;
  fechaLimitePago?: string | null;
  items: {
    productoId: number;
    cantidad: number;
    extraId?: number | null;
    variadaSelecciones?: number[];
  }[];
  pagos?: { metodo: string; monto: number }[];
};

export function validarVenta(body: VentaBody): string | null {
  if (!body.fecha || !body.cliente || typeof body.cliente !== "string") {
    return "Fecha y cliente son obligatorios";
  }

  if (!body.clienteNombre?.trim()) {
    return "El nombre del cliente es obligatorio";
  }

  const telefonoError = validarTelefono(body.clienteTelefono ?? "");
  if (telefonoError) {
    return telefonoError;
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

  if (body.despachoPendiente && (!body.horaEntrega || !body.horaPreparacion)) {
    return "Debes indicar la hora de entrega y de preparación para un despacho pendiente";
  }

  if ((!body.pagos || body.pagos.length === 0) && !body.fechaLimitePago) {
    return "Indica la fecha límite de pago: esta venta quedará como cuenta por cobrar";
  }

  return null;
}

// Resuelve el nombre a mostrar del motorizado asignado a partir de su id,
// para mantener delivery_asignado como texto legible en los reportes.
export async function resolveDeliveryAsignado(
  client: PoolClient,
  body: VentaBody
): Promise<string | null> {
  if (!body.motorizadoId) return body.deliveryAsignado || null;

  const result = await client.query(
    `SELECT nombre, apellido FROM motorizados WHERE id = $1`,
    [body.motorizadoId]
  );

  if (result.rowCount === 0) return body.deliveryAsignado || null;

  const { nombre, apellido } = result.rows[0];
  return apellido ? `${nombre} ${apellido}` : nombre;
}

// Guarda/actualiza el cliente en el catálogo a partir de los datos de la
// venta, para poder reutilizarlo en ventas futuras sin duplicar registros.
// Si la cédula ya existe, actualiza el nombre y la dirección del cliente.
// Si no tiene cédula, se busca por nombre y apellido para evitar duplicados.
export async function guardarCliente(client: PoolClient, body: VentaBody) {
  const nombre = body.clienteNombre?.trim() || body.cliente.trim();
  if (!nombre) return;

  const apellido = body.clienteApellido?.trim() || null;
  const cedula = body.clienteCi?.trim() || null;
  const direccion = body.direccion?.trim() || null;
  const telefono = body.clienteTelefono?.trim() || null;

  if (cedula) {
    await client.query(
      `INSERT INTO clientes (nombre, apellido, cedula, direccion, telefono)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cedula) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             apellido = EXCLUDED.apellido,
             direccion = COALESCE(EXCLUDED.direccion, clientes.direccion),
             telefono = COALESCE(EXCLUDED.telefono, clientes.telefono)`,
      [nombre, apellido, cedula, direccion, telefono]
    );
    return;
  }

  const existente = await client.query(
    `SELECT id FROM clientes
     WHERE cedula IS NULL AND lower(nombre) = lower($1) AND lower(COALESCE(apellido, '')) = lower(COALESCE($2, ''))`,
    [nombre, apellido]
  );

  if (existente.rowCount && existente.rowCount > 0) {
    await client.query(
      `UPDATE clientes
       SET direccion = COALESCE($2, direccion), telefono = COALESCE($3, telefono)
       WHERE id = $1`,
      [existente.rows[0].id, direccion, telefono]
    );
    return;
  }

  await client.query(
    `INSERT INTO clientes (nombre, apellido, cedula, direccion, telefono)
     VALUES ($1, $2, NULL, $3, $4)`,
    [nombre, apellido, direccion, telefono]
  );
}

// Descuenta unidades del inventario de un producto y registra el movimiento
// asociado a la venta, para poder revertirlo si la venta se edita o elimina.
async function descontarInventario(
  client: PoolClient,
  productoId: number,
  cantidad: number,
  ventaId: number
) {
  await client.query(
    `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2`,
    [cantidad, productoId]
  );
  await client.query(
    `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, venta_id)
     VALUES ($1, 'VENTA', $2, $3)`,
    [productoId, -cantidad, ventaId]
  );
}

// Revierte los descuentos de inventario aplicados por una venta (usado antes
// de reeditar o eliminar la venta), restaurando el stock de cada producto.
export async function revertirInventarioVenta(client: PoolClient, ventaId: number) {
  const movimientos = await client.query(
    `SELECT producto_id, cantidad FROM inventario_movimientos
     WHERE venta_id = $1 AND tipo = 'VENTA'`,
    [ventaId]
  );

  for (const mov of movimientos.rows) {
    await client.query(
      `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [mov.cantidad, mov.producto_id]
    );
  }

  await client.query(
    `DELETE FROM inventario_movimientos WHERE venta_id = $1 AND tipo = 'VENTA'`,
    [ventaId]
  );
}

export async function insertarItemsYPagos(
  client: PoolClient,
  ventaId: number,
  body: VentaBody
) {
  for (const item of body.items) {
    const productoResult = await client.query(
      `SELECT costo, precio_venta, tipo_producto, variada_raciones FROM productos WHERE id = $1`,
      [item.productoId]
    );

    if (productoResult.rowCount === 0) {
      throw new Error(`Producto ${item.productoId} no encontrado`);
    }

    const cantidadNum = Number(item.cantidad);
    if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      throw new Error("Cantidad inválida");
    }

    const { costo, precio_venta, tipo_producto, variada_raciones } = productoResult.rows[0];

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

    const itemResult = await client.query(
      `INSERT INTO venta_items (venta_id, producto_id, cantidad, costo_unit, precio_unit, extra_id, extra_nombre, extra_precio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [ventaId, item.productoId, cantidadNum, costo, precioUnit, extraId, extraNombre, extraPrecio]
    );

    const ventaItemId = itemResult.rows[0].id;

    if (tipo_producto === "NORMAL") {
      await descontarInventario(client, item.productoId, cantidadNum, ventaId);
    } else if (tipo_producto === "COMBO") {
      const componentesResult = await client.query(
        `SELECT componente_id, cantidad FROM producto_componentes WHERE producto_id = $1`,
        [item.productoId]
      );

      for (const componente of componentesResult.rows) {
        await descontarInventario(
          client,
          componente.componente_id,
          Number(componente.cantidad) * cantidadNum,
          ventaId
        );
      }
    } else if (tipo_producto === "VARIADA") {
      const selecciones = item.variadaSelecciones ?? [];
      const racionesEsperadas = Number(variada_raciones) || 0;

      if (racionesEsperadas > 0 && selecciones.length !== racionesEsperadas) {
        throw new Error(
          `Debes seleccionar ${racionesEsperadas} ración(es) para "Bandeja Variada"`
        );
      }

      for (const seleccionId of selecciones) {
        await descontarInventario(client, Number(seleccionId), cantidadNum, ventaId);
        await client.query(
          `INSERT INTO venta_item_variada (venta_item_id, producto_id, cantidad)
           VALUES ($1, $2, $3)`,
          [ventaItemId, Number(seleccionId), cantidadNum]
        );
      }
    }
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

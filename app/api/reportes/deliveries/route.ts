import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const pagado = searchParams.get("pagado");
  const ventaId = searchParams.get("ventaId");
  const cliente = searchParams.get("cliente");
  const motorizadoId = searchParams.get("motorizadoId");

  const conditions: string[] = ["v.despacho_pendiente = TRUE", "v.modo_entrega = 'DELIVERY'"];
  const params: unknown[] = [];

  if (desde) {
    params.push(desde);
    conditions.push(`v.fecha >= $${params.length}`);
  }

  if (hasta) {
    params.push(hasta);
    conditions.push(`v.fecha <= $${params.length}`);
  }

  if (pagado === "PAGADO") {
    conditions.push("v.delivery_pagado = TRUE");
  } else if (pagado === "PENDIENTE") {
    conditions.push("v.delivery_pagado = FALSE");
  }

  if (ventaId) {
    const ventaIdNum = Number(ventaId);
    if (!Number.isNaN(ventaIdNum)) {
      params.push(ventaIdNum);
      conditions.push(`v.id = $${params.length}`);
    }
  }

  if (cliente) {
    params.push(`%${cliente}%`);
    conditions.push(`v.cliente ILIKE $${params.length}`);
  }

  if (motorizadoId) {
    const motorizadoIdNum = Number(motorizadoId);
    if (!Number.isNaN(motorizadoIdNum)) {
      params.push(motorizadoIdNum);
      conditions.push(`v.motorizado_id = $${params.length}`);
    }
  }

  const result = await pool.query(
    `SELECT v.id, v.fecha, v.cliente, v.cliente_ci, v.delivery_asignado, v.motorizado_id,
            v.costo_delivery, v.tasa_dia, v.delivery_pagado, v.delivery_pagado_at,
            m.nombre AS motorizado_nombre
     FROM ventas v
     LEFT JOIN motorizados m ON m.id = v.motorizado_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY v.fecha DESC, v.id DESC`,
    params
  );

  const items = result.rows.map((row) => {
    const costoDeliveryUsd = Number(row.costo_delivery);
    const tasa = Number(row.tasa_dia);
    return {
      ventaId: row.id,
      fecha: row.fecha,
      cliente: row.cliente,
      clienteCi: row.cliente_ci,
      deliveryAsignado: row.delivery_asignado,
      motorizadoId: row.motorizado_id,
      motorizadoNombre: row.motorizado_nombre,
      costoDeliveryUsd,
      costoDeliveryBs: costoDeliveryUsd * tasa,
      deliveryPagado: row.delivery_pagado,
      deliveryPagadoAt: row.delivery_pagado_at,
    };
  });

  return NextResponse.json({ items });
}

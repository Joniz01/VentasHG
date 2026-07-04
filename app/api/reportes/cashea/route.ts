import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado"); // "PENDIENTE" | "LIQUIDADO" | null=TODOS

  let whereClause = "";
  if (estado === "PENDIENTE") whereClause = "WHERE cp.liquidado = FALSE";
  else if (estado === "LIQUIDADO") whereClause = "WHERE cp.liquidado = TRUE";

  const result = await pool.query(
    `SELECT cp.venta_id, v.fecha, v.cliente,
            cp.porcentaje, cp.monto_inicial, cp.monto_financiado,
            cp.dias, cp.fecha_vencimiento, cp.liquidado, cp.liquidado_at,
            cp.alarma_silenciada_hasta
     FROM cashea_pagos cp
     JOIN ventas v ON v.id = cp.venta_id
     ${whereClause}
     ORDER BY cp.fecha_vencimiento ASC, cp.venta_id DESC`
  );

  const items = result.rows.map((row) => ({
    ventaId: row.venta_id,
    fecha: row.fecha,
    cliente: row.cliente,
    porcentaje: Number(row.porcentaje),
    montoInicial: Number(row.monto_inicial),
    montoFinanciado: Number(row.monto_financiado),
    dias: Number(row.dias),
    fechaVencimiento: row.fecha_vencimiento,
    liquidado: row.liquidado,
    liquidadoAt: row.liquidado_at,
    alarmaSilenciadaHasta: row.alarma_silenciada_hasta,
  }));

  return NextResponse.json({ items });
}

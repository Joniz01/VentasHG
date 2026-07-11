import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado"); // "PENDIENTE" | "LIQUIDADO" | null=TODOS

  let whereClause = "";
  if (estado === "PENDIENTE") whereClause = "WHERE yp.liquidado = FALSE";
  else if (estado === "LIQUIDADO") whereClause = "WHERE yp.liquidado = TRUE";

  try {
    const result = await pool.query(
      `SELECT yp.venta_id, v.fecha, v.cliente,
              yp.monto, yp.dias, yp.fecha_vencimiento,
              yp.liquidado, yp.liquidado_at
       FROM yummy_pagos yp
       JOIN ventas v ON v.id = yp.venta_id
       ${whereClause}
       ORDER BY yp.fecha_vencimiento ASC, yp.venta_id DESC`
    );

    const items = result.rows.map((row) => ({
      ventaId: row.venta_id,
      fecha: row.fecha,
      cliente: row.cliente,
      monto: Number(row.monto),
      dias: Number(row.dias),
      fechaVencimiento: row.fecha_vencimiento,
      liquidado: row.liquidado,
      liquidadoAt: row.liquidado_at,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/reportes/yummy]", msg);
    return NextResponse.json({ items: [], error: msg });
  }
}

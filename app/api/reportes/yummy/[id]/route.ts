import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  try {
    if (typeof body.liquidado === "boolean") {
      const liquidadoAt = body.liquidado ? new Date().toISOString() : null;
      const result = await pool.query(
        `UPDATE yummy_pagos
         SET liquidado = $1, liquidado_at = $2
         WHERE venta_id = $3
         RETURNING venta_id, liquidado, liquidado_at`,
        [body.liquidado, liquidadoAt, id]
      );
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "Pago Yummy no encontrado" }, { status: 404 });
      }
      return NextResponse.json({
        liquidado: result.rows[0].liquidado,
        liquidadoAt: result.rows[0].liquidado_at,
      });
    }
  } catch {
    return NextResponse.json({ error: "Migración Yummy pendiente" }, { status: 503 });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

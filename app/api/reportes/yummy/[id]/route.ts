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
         RETURNING venta_id, liquidado, liquidado_at, monto`,
        [body.liquidado, liquidadoAt, id]
      );
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "Pago Yummy no encontrado" }, { status: 404 });
      }

      // El monto cobrado por Yummy se refleja como forma de pago "Yummy" en
      // el reporte de Formas de Pago, con la fecha en que realmente entró
      // el dinero (por defecto hoy, o una fecha anterior si el operador lo
      // registra tarde).
      await pool.query(`DELETE FROM pagos_venta WHERE venta_id = $1 AND metodo = 'YUMMY'`, [id]);
      if (body.liquidado) {
        const fechaPago = body.fechaPago || new Date().toISOString().slice(0, 10);
        await pool.query(
          `INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago) VALUES ($1, 'YUMMY', $2, $3)`,
          [id, result.rows[0].monto, fechaPago]
        );
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

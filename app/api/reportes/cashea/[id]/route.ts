import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  try {
    if (body.silenciar) {
      const hasta = new Date(Date.now() + (body.minutos ?? 60) * 60_000).toISOString();
      await pool.query(
        `UPDATE cashea_pagos SET alarma_silenciada_hasta = $1 WHERE venta_id = $2`,
        [hasta, id]
      );
      return NextResponse.json({ ok: true });
    }

    if (typeof body.liquidado === "boolean") {
      const liquidadoAt = body.liquidado ? new Date().toISOString() : null;
      const result = await pool.query(
        `UPDATE cashea_pagos
         SET liquidado = $1, liquidado_at = $2
         WHERE venta_id = $3
         RETURNING venta_id, liquidado, liquidado_at, monto_financiado`,
        [body.liquidado, liquidadoAt, id]
      );
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "Pago Cashea no encontrado" }, { status: 404 });
      }

      // El financiado cobrado por Cashea se refleja como forma de pago
      // "Cashea" en el reporte de Formas de Pago, con la fecha en que
      // realmente entró el dinero (por defecto hoy, pero el operador puede
      // elegir una fecha anterior si el cobro se registró tarde).
      await pool.query(`DELETE FROM pagos_venta WHERE venta_id = $1 AND metodo = 'CASHEA'`, [id]);
      if (body.liquidado) {
        const fechaPago = body.fechaPago || new Date().toISOString().slice(0, 10);
        await pool.query(
          `INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago) VALUES ($1, 'CASHEA', $2, $3)`,
          [id, result.rows[0].monto_financiado, fechaPago]
        );
      }

      return NextResponse.json({
        liquidado: result.rows[0].liquidado,
        liquidadoAt: result.rows[0].liquidado_at,
      });
    }
  } catch {
    return NextResponse.json({ error: "Migración Cashea pendiente" }, { status: 503 });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}

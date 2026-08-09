import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { cuentaCobrada, alarmaSilenciadaHasta } = body;

  if (typeof cuentaCobrada === "boolean") {
    const { fechaPago } = body as { fechaPago?: string };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE ventas
         SET cuenta_cobrada = $1,
             cuenta_cobrada_at = CASE WHEN $1 THEN now() ELSE NULL END
         WHERE id = $2 AND cuenta_por_cobrar = TRUE
           AND NOT EXISTS (SELECT 1 FROM cashea_pagos cp WHERE cp.venta_id = $2)
           AND NOT EXISTS (SELECT 1 FROM yummy_pagos  yp WHERE yp.venta_id = $2)
         RETURNING id, cuenta_cobrada, cuenta_cobrada_at, alarma_vencimiento_silenciada_hasta,
                   tasa_dia,
                   COALESCE((SELECT SUM(vi.precio_unit * vi.cantidad) FROM venta_items vi WHERE vi.venta_id = $2), 0)
                     + COALESCE(costo_delivery, 0) AS total_usd`,
        [cuentaCobrada, id]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Cuenta por cobrar no encontrada" }, { status: 404 });
      }

      const row = result.rows[0];

      // Sincronizar pagos_venta: borrar entrada previa y reinsertar si cobrada
      await client.query(
        `DELETE FROM pagos_venta WHERE venta_id = $1 AND metodo = 'CXC_DIRECTA'`,
        [id]
      );
      if (cuentaCobrada) {
        const fp = fechaPago || new Date().toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago)
           VALUES ($1, 'CXC_DIRECTA', $2, $3)`,
          [id, row.total_usd, fp]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({
        ventaId: row.id,
        cuentaCobrada: row.cuenta_cobrada,
        cuentaCobradaAt: row.cuenta_cobrada_at,
        alarmaSilenciadaHasta: row.alarma_vencimiento_silenciada_hasta,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  if (typeof alarmaSilenciadaHasta === "string" || alarmaSilenciadaHasta === null) {
    const result = await pool.query(
      `UPDATE ventas
       SET alarma_vencimiento_silenciada_hasta = $1
       WHERE id = $2 AND cuenta_por_cobrar = TRUE
       RETURNING id, cuenta_cobrada, cuenta_cobrada_at, alarma_vencimiento_silenciada_hasta`,
      [alarmaSilenciadaHasta, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Cuenta por cobrar no encontrada" }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      ventaId: row.id,
      cuentaCobrada: row.cuenta_cobrada,
      cuentaCobradaAt: row.cuenta_cobrada_at,
      alarmaSilenciadaHasta: row.alarma_vencimiento_silenciada_hasta,
    });
  }

  return NextResponse.json(
    { error: "cuentaCobrada o alarmaSilenciadaHasta es requerido" },
    { status: 400 }
  );
}

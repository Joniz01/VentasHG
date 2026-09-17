import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT ni.id, ni.nomina_pago_id, ni.monto_bs,
             np.empleado_id, np.salario_base_bs,
             pn.id as periodo_id, pn.tasa_dia, (ni.monto_bs / pn.tasa_dia) as calculated_usd
      FROM nomina_incidencias ni
      JOIN nomina_pagos np ON np.id = ni.nomina_pago_id
      JOIN periodos_nomina pn ON pn.id = np.periodo_id
      WHERE pn.nomina_id = 7 AND pn.fecha_desde >= '2026-09-15'
      ORDER BY pn.id DESC, ni.id;
    `);

    return NextResponse.json({
      rows: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

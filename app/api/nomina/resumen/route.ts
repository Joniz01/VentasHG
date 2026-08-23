import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HOY = `(NOW() AT TIME ZONE 'America/Caracas')::date`;

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const empleadosResult = await pool.query(
      `SELECT COUNT(*) AS total FROM empleados WHERE activo = TRUE`
    );

    const totalUsdExpr = `
      COALESCE(SUM(
        CASE WHEN pn.tasa_dia > 0
          THEN (np.salario_base_bs + COALESCE(inc.total_incidencias_bs, 0)) / pn.tasa_dia
          ELSE 0
        END
      ), 0)
    `;

    const pendienteResult = await pool.query(
      `SELECT ${totalUsdExpr} AS total
       FROM nomina_pagos np
       JOIN periodos_nomina pn ON pn.id = np.periodo_id
       LEFT JOIN (
         SELECT nomina_pago_id, SUM(monto_bs) AS total_incidencias_bs
         FROM nomina_incidencias GROUP BY nomina_pago_id
       ) inc ON inc.nomina_pago_id = np.id
       WHERE np.estado = 'PENDIENTE'`
    );

    const pagadaMesResult = await pool.query(
      `SELECT ${totalUsdExpr} AS total
       FROM nomina_pagos np
       JOIN periodos_nomina pn ON pn.id = np.periodo_id
       LEFT JOIN (
         SELECT nomina_pago_id, SUM(monto_bs) AS total_incidencias_bs
         FROM nomina_incidencias GROUP BY nomina_pago_id
       ) inc ON inc.nomina_pago_id = np.id
       WHERE np.estado = 'PAGADO'
         AND date_trunc('month', (np.pagado_at AT TIME ZONE 'America/Caracas')) = date_trunc('month', ${HOY})`
    );

    // Próxima semana: lunes al domingo siguiente
    const proximaSemanaResult = await pool.query(
      `WITH semana AS (
         SELECT
           (date_trunc('week', ${HOY} + INTERVAL '7 days'))::date AS lunes,
           (date_trunc('week', ${HOY} + INTERVAL '7 days') + INTERVAL '6 days')::date AS domingo
       )
       SELECT
         COUNT(DISTINCT pn.id)::int AS periodos,
         COALESCE(SUM(
           CASE WHEN pn.tasa_dia > 0
             THEN (np.salario_base_bs + COALESCE(inc.total_incidencias_bs, 0)) / pn.tasa_dia
             ELSE 0
           END
         ), 0) AS total_usd,
         (SELECT lunes FROM semana) AS lunes,
         (SELECT domingo FROM semana) AS domingo
       FROM semana, periodos_nomina pn
       JOIN nomina_pagos np ON np.periodo_id = pn.id
       LEFT JOIN (
         SELECT nomina_pago_id, SUM(monto_bs) AS total_incidencias_bs
         FROM nomina_incidencias GROUP BY nomina_pago_id
       ) inc ON inc.nomina_pago_id = np.id
       WHERE np.estado = 'PENDIENTE'
         AND pn.fecha_fin BETWEEN semana.lunes AND semana.domingo`
    );

    const ps = proximaSemanaResult.rows[0];

    return NextResponse.json({
      empleadosActivos: Number(empleadosResult.rows[0]?.total ?? 0),
      nominaPendiente: Number(pendienteResult.rows[0]?.total ?? 0),
      nominaPagadaMes: Number(pagadaMesResult.rows[0]?.total ?? 0),
      proximaSemana: {
        periodos: Number(ps?.periodos ?? 0),
        totalUsd: Number(ps?.total_usd ?? 0),
        lunes: ps?.lunes ? (ps.lunes instanceof Date ? ps.lunes.toISOString().slice(0, 10) : String(ps.lunes).slice(0, 10)) : null,
        domingo: ps?.domingo ? (ps.domingo instanceof Date ? ps.domingo.toISOString().slice(0, 10) : String(ps.domingo).slice(0, 10)) : null,
      },
    });
  } catch {
    return NextResponse.json({ empleadosActivos: 0, nominaPendiente: 0, nominaPagadaMes: 0, proximaSemana: { periodos: 0, totalUsd: 0, lunes: null, domingo: null } });
  }
}

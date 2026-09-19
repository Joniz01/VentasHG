import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import { sqlMontoEstimadoUsd, sqlSalarioBaseUsdDelPago } from "@/lib/nomina-montos";

export const dynamic = "force-dynamic";

const HOY = `(NOW() AT TIME ZONE 'America/Caracas')::date`;

const SALARIO_BASE_USD = sqlSalarioBaseUsdDelPago({
  salarioBaseBs: "np.salario_base_bs",
  salarioUsdEmpleado: "e.salario_base_usd",
});

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const empleadosResult = await pool.query(
      `SELECT COUNT(*) AS total FROM empleados WHERE activo = TRUE`
    );

    const pendienteResult = await pool.query(
      `SELECT COALESCE(SUM(
         ${SALARIO_BASE_USD} +
         CASE WHEN pn.tasa_dia > 0 THEN COALESCE(inc.total_incidencias_bs, 0) / pn.tasa_dia ELSE 0 END
       ), 0) AS total
       FROM nomina_pagos np
       JOIN periodos_nomina pn ON pn.id = np.periodo_id
       JOIN empleados e ON e.id = np.empleado_id
       LEFT JOIN (
         SELECT nomina_pago_id, SUM(monto_bs) AS total_incidencias_bs
         FROM nomina_incidencias GROUP BY nomina_pago_id
       ) inc ON inc.nomina_pago_id = np.id
       WHERE np.estado = 'PENDIENTE'`
    );

    const pagadaMesResult = await pool.query(
      `SELECT COALESCE(SUM(
         ${SALARIO_BASE_USD} +
         CASE WHEN pn.tasa_dia > 0 THEN COALESCE(inc.total_incidencias_bs, 0) / pn.tasa_dia ELSE 0 END
       ), 0) AS total
       FROM nomina_pagos np
       JOIN periodos_nomina pn ON pn.id = np.periodo_id
       JOIN empleados e ON e.id = np.empleado_id
       LEFT JOIN (
         SELECT nomina_pago_id, SUM(monto_bs) AS total_incidencias_bs
         FROM nomina_incidencias GROUP BY nomina_pago_id
       ) inc ON inc.nomina_pago_id = np.id
       WHERE np.estado = 'PAGADO'
         AND date_trunc('month', (np.pagado_at AT TIME ZONE 'America/Caracas')) = date_trunc('month', ${HOY})`
    );

    // Próxima semana: lunes al domingo siguiente
    // date_trunc('week',...) devuelve el lunes de la semana que contiene la fecha
    const proximaSemanaResult = await pool.query(
      `WITH semana AS (
         SELECT
           (date_trunc('week', ${HOY} + INTERVAL '7 days'))::date AS lunes,
           (date_trunc('week', ${HOY} + INTERVAL '7 days') + INTERVAL '6 days')::date AS domingo
       ),
       -- Períodos ya generados con pagos PENDIENTE cuya fecha_hasta cae en próxima semana
       periodos_gen AS (
         SELECT
           COUNT(DISTINCT pn.id)::int AS periodos,
           COALESCE(SUM(
             ${SALARIO_BASE_USD} +
             CASE WHEN pn.tasa_dia > 0 THEN COALESCE(inc.total_incidencias_bs, 0) / pn.tasa_dia ELSE 0 END
           ), 0) AS total_usd
         FROM semana, periodos_nomina pn
         JOIN nomina_pagos np ON np.periodo_id = pn.id
         JOIN empleados e ON e.id = np.empleado_id
         LEFT JOIN (
           SELECT nomina_pago_id, SUM(monto_bs) AS total_incidencias_bs
           FROM nomina_incidencias GROUP BY nomina_pago_id
         ) inc ON inc.nomina_pago_id = np.id
         WHERE np.estado = 'PENDIENTE'
           AND pn.fecha_hasta BETWEEN semana.lunes AND semana.domingo
       ),
       -- Nóminas automáticas semanales cuyo dia_semana cae en próxima semana.
       -- La estimación depende del tipo: una nómina de solo incidencias no paga
       -- sueldo base, y una de solo sueldo no lleva incidencias.
       nominas_auto_base AS (
         SELECT
           n.id,
           COALESCE(n.tipo,'NORMAL') AS tipo,
           COALESCE(SUM(e.salario_base_usd), 0) AS total_salario,
           COUNT(DISTINCT e.id) AS nro_empleados,
           (semana.lunes + (CASE WHEN n.dia_semana = 0 THEN 6 ELSE n.dia_semana - 1 END) * INTERVAL '1 day')::date AS fecha_pago
         FROM semana, nominas n
         JOIN empleado_nominas en ON en.nomina_id = n.id
         JOIN empleados e ON e.id = en.empleado_id AND e.activo = TRUE
         WHERE n.activo = TRUE
           AND n.modo_generacion = 'AUTOMATICO'
           AND n.frecuencia = 'SEMANAL'
           AND n.dia_semana IS NOT NULL
           -- dia_semana: 0=dom,1=lun,...,6=sab (ISO: lun=1..dom=7)
           -- lunes de próxima semana + (dia_semana - 1) días = fecha de pago
           AND (semana.lunes + (CASE WHEN n.dia_semana = 0 THEN 6 ELSE n.dia_semana - 1 END) * INTERVAL '1 day')::date
               BETWEEN semana.lunes AND semana.domingo
           -- Excluir si ya hay un período generado para esa semana
           AND NOT EXISTS (
             SELECT 1 FROM periodos_nomina pn2
             WHERE pn2.nomina_id = n.id
               AND pn2.fecha_hasta BETWEEN semana.lunes AND semana.domingo
           )
         GROUP BY n.id, n.tipo, n.dia_semana, semana.lunes
       ),
       nominas_auto AS (
         SELECT
           COUNT(*)::int AS nominas,
           COALESCE(SUM(${sqlMontoEstimadoUsd({
             tipo: "b.tipo",
             salarioUsd: "b.total_salario",
             incidenciaUsdPorEmpleado: "COALESCE(ic.total_inc_usd, 0)",
             nroEmpleados: "b.nro_empleados",
           })}), 0) AS total_usd,
           MIN(b.fecha_pago) AS fecha_pago
         FROM nominas_auto_base b
         LEFT JOIN (
           SELECT nomina_id, SUM(monto_usd) AS total_inc_usd
           FROM nomina_incidencia_config GROUP BY nomina_id
         ) ic ON ic.nomina_id = b.id
       ),
       -- Fecha de pago más próxima de períodos ya generados pendientes
       periodos_gen_fecha AS (
         SELECT MIN(pn.fecha_hasta)::date AS fecha_pago
         FROM semana, periodos_nomina pn
         JOIN nomina_pagos np ON np.periodo_id = pn.id
         WHERE np.estado = 'PENDIENTE'
           AND pn.fecha_hasta BETWEEN semana.lunes AND semana.domingo
       )
       SELECT
         (SELECT lunes FROM semana) AS lunes,
         (SELECT domingo FROM semana) AS domingo,
         (pg.periodos + na.nominas)::int AS periodos,
         (pg.total_usd + na.total_usd) AS total_usd,
         LEAST(
           (SELECT fecha_pago FROM periodos_gen_fecha),
           na.fecha_pago
         ) AS fecha_pago
       FROM periodos_gen pg, nominas_auto na`
    );

    // Nóminas individuales pendientes de generar para próxima semana
    const nominasPendientesResult = await pool.query(
      `WITH semana AS (
         SELECT
           (date_trunc('week', ${HOY} + INTERVAL '7 days'))::date AS lunes,
           (date_trunc('week', ${HOY} + INTERVAL '7 days') + INTERVAL '6 days')::date AS domingo
       )
       SELECT
         n.id,
         n.nombre,
         ${sqlMontoEstimadoUsd({
           tipo: "COALESCE(n.tipo,'NORMAL')",
           salarioUsd: "COALESCE(SUM(e.salario_base_usd), 0)",
           incidenciaUsdPorEmpleado: "COALESCE(ic.total_inc_usd, 0)",
           nroEmpleados: "COUNT(DISTINCT e.id)",
         })} AS total_usd_estimado,
         semana.lunes,
         semana.domingo,
         (semana.lunes + (CASE WHEN n.dia_semana = 0 THEN 6 ELSE n.dia_semana - 1 END) * INTERVAL '1 day')::date AS fecha_hasta
       FROM semana, nominas n
       JOIN empleado_nominas en ON en.nomina_id = n.id
       JOIN empleados e ON e.id = en.empleado_id AND e.activo = TRUE
       LEFT JOIN (
         SELECT nomina_id, SUM(monto_usd) AS total_inc_usd
         FROM nomina_incidencia_config GROUP BY nomina_id
       ) ic ON ic.nomina_id = n.id
       WHERE n.activo = TRUE
         AND n.modo_generacion = 'AUTOMATICO'
         AND n.frecuencia = 'SEMANAL'
         AND n.dia_semana IS NOT NULL
         AND (semana.lunes + (CASE WHEN n.dia_semana = 0 THEN 6 ELSE n.dia_semana - 1 END) * INTERVAL '1 day')::date
             BETWEEN semana.lunes AND semana.domingo
         AND NOT EXISTS (
           SELECT 1 FROM periodos_nomina pn2
           WHERE pn2.nomina_id = n.id
             AND pn2.fecha_hasta BETWEEN semana.lunes AND semana.domingo
         )
       GROUP BY n.id, n.nombre, n.tipo, n.dia_semana, semana.lunes, semana.domingo, ic.total_inc_usd`
    ).catch(() => ({ rows: [] }));

    const ps = proximaSemanaResult.rows[0];
    const toDate = (v: unknown) => v ? (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10)) : null;

    return NextResponse.json({
      empleadosActivos: Number(empleadosResult.rows[0]?.total ?? 0),
      nominaPendiente: Number(pendienteResult.rows[0]?.total ?? 0),
      nominaPagadaMes: Number(pagadaMesResult.rows[0]?.total ?? 0),
      proximaSemana: {
        periodos: Number(ps?.periodos ?? 0),
        totalUsd: Number(ps?.total_usd ?? 0),
        lunes: toDate(ps?.lunes),
        domingo: toDate(ps?.domingo),
        fechaPago: toDate(ps?.fecha_pago),
        nominasPendientes: nominasPendientesResult.rows.map((r) => ({
          nominaId: Number(r.id),
          nominaNombre: String(r.nombre),
          totalUsdEstimado: Number(r.total_usd_estimado),
          lunes: toDate(r.lunes),
          domingo: toDate(r.domingo),
          fechaHasta: toDate(r.fecha_hasta),
        })),
      },
    });
  } catch {
    return NextResponse.json({ empleadosActivos: 0, nominaPendiente: 0, nominaPagadaMes: 0, proximaSemana: { periodos: 0, totalUsd: 0, lunes: null, domingo: null } });
  }
}

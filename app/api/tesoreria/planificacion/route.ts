import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

function toDate(v: unknown): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function lunesDeHoy(hoy: string): string {
  const d = new Date(`${hoy}T00:00:00`);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function inicioMes(hoy: string): string {
  return hoy.slice(0, 8) + "01";
}

type RawItem = {
  id: string;
  tipo: string;
  descripcion: string;
  fecha_vencimiento: unknown;
  monto_bs: string;
  tasa_dia: string;
  referencia: string | null;
};

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = hoyCaracas();
  const lunes = lunesDeHoy(hoy);
  const domingo = addDays(lunes, 6);
  // Ventana: desde 4 semanas atrás hasta 4 semanas adelante
  const desde = addDays(hoy, -28);
  const hasta = addDays(hoy, 28);
  const mesInicio = inicioMes(hoy);

  // ── Query nóminas (períodos con pagos pendientes) ──────────────────────────
  let nominaRows: RawItem[] = [];
  try {
    const r = await pool.query<RawItem>(
      `SELECT
        'N' || pn.id                                                              AS id,
        'nomina'                                                                  AS tipo,
        n.nombre || ' · ' || TO_CHAR(pn.fecha_desde,'DD/MM') || '–' || TO_CHAR(pn.fecha_hasta,'DD/MM/YYYY') AS descripcion,
        pn.fecha_hasta                                                            AS fecha_vencimiento,
        COALESCE(SUM(np.salario_base_bs), 0)
          + COALESCE((
              SELECT SUM(ni.monto_bs)
              FROM nomina_incidencias ni
              JOIN nomina_pagos np2 ON np2.id = ni.nomina_pago_id AND np2.estado = 'PENDIENTE'
              WHERE np2.periodo_id = pn.id
            ), 0)                                                                 AS monto_bs,
        pn.tasa_dia                                                               AS tasa_dia,
        NULL::text                                                                AS referencia
      FROM periodos_nomina pn
      JOIN nominas n ON n.id = pn.nomina_id
      JOIN nomina_pagos np ON np.periodo_id = pn.id AND np.estado = 'PENDIENTE'
      WHERE pn.fecha_hasta BETWEEN $1 AND $2
      GROUP BY pn.id, n.nombre, pn.fecha_desde, pn.fecha_hasta, pn.tasa_dia
      HAVING COALESCE(SUM(np.salario_base_bs), 0) > 0
      ORDER BY pn.fecha_hasta ASC`,
      [desde, hasta]
    );
    nominaRows = r.rows;
  } catch {
    // periodos_nomina or nomina_pagos not yet migrated — skip silently
  }

  // ── Query gastos pendientes (defensivo ante columnas opcionales) ───────────
  let gastoRows: RawItem[] = [];
  try {
    // Intento con numero_factura y tipos_gasto
    const r = await pool.query<RawItem>(
      `SELECT
        'G' || g.id                                                               AS id,
        CASE WHEN g.recurrente THEN 'gasto-fijo' ELSE 'gasto' END                AS tipo,
        COALESCE(tg.nombre, g.tipo::text) || ' · ' || g.proveedor                AS descripcion,
        g.fecha                                                                   AS fecha_vencimiento,
        g.monto_bs                                                                AS monto_bs,
        g.tasa_dia                                                                AS tasa_dia,
        g.numero_factura                                                          AS referencia
      FROM gastos g
      LEFT JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id
      WHERE g.estado = 'PENDIENTE'
        AND g.fecha BETWEEN $1 AND $2
      ORDER BY g.fecha ASC`,
      [desde, hasta]
    );
    gastoRows = r.rows;
  } catch {
    // numero_factura puede no existir aún — reintentar sin ella
    try {
      const r = await pool.query<RawItem>(
        `SELECT
          'G' || g.id                                                             AS id,
          CASE WHEN g.recurrente THEN 'gasto-fijo' ELSE 'gasto' END              AS tipo,
          COALESCE(tg.nombre, g.tipo::text) || ' · ' || g.proveedor              AS descripcion,
          g.fecha                                                                 AS fecha_vencimiento,
          g.monto_bs                                                              AS monto_bs,
          g.tasa_dia                                                              AS tasa_dia,
          NULL::text                                                              AS referencia
        FROM gastos g
        LEFT JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id
        WHERE g.estado = 'PENDIENTE'
          AND g.fecha BETWEEN $1 AND $2
        ORDER BY g.fecha ASC`,
        [desde, hasta]
      );
      gastoRows = r.rows;
    } catch {
      // tipos_gasto also missing — last resort
      try {
        const r = await pool.query<RawItem>(
          `SELECT
            'G' || g.id                                                           AS id,
            CASE WHEN g.recurrente THEN 'gasto-fijo' ELSE 'gasto' END            AS tipo,
            g.tipo::text || ' · ' || g.proveedor                                  AS descripcion,
            g.fecha                                                               AS fecha_vencimiento,
            g.monto_bs                                                            AS monto_bs,
            g.tasa_dia                                                            AS tasa_dia,
            NULL::text                                                            AS referencia
          FROM gastos g
          WHERE g.estado = 'PENDIENTE'
            AND g.fecha BETWEEN $1 AND $2
          ORDER BY g.fecha ASC`,
          [desde, hasta]
        );
        gastoRows = r.rows;
      } catch {
        // gastos table unavailable — skip
      }
    }
  }

  // ── Nóminas automáticas estimadas (sin período generado) dentro de la ventana ─
  type EstimadaRow = { nomina_id: number; nombre: string; fecha_pago: string; total_usd: number };
  let nominasEstimadas: EstimadaRow[] = [];

  // Query 1: semanales automáticas
  try {
    const r = await pool.query<{ nomina_id: string; nombre: string; fecha_pago: unknown; total_usd: string }>(
      `WITH semanas_ventana AS (
         SELECT generate_series(0, 5) AS offset
       ),
       fechas AS (
         SELECT n.id AS nomina_id, n.nombre,
           (date_trunc('week', $1::date + sv.offset * 7)
             + (CASE WHEN n.dia_semana = 0 THEN 6 ELSE n.dia_semana - 1 END) * INTERVAL '1 day')::date AS fecha_pago
         FROM semanas_ventana sv, nominas n
         WHERE n.activo = TRUE AND n.modo_generacion = 'AUTOMATICO'
           AND n.frecuencia = 'SEMANAL' AND n.dia_semana IS NOT NULL
       ),
       filtradas AS (
         SELECT DISTINCT f.nomina_id, f.nombre, f.fecha_pago
         FROM fechas f
         WHERE f.fecha_pago BETWEEN $1 AND $2
           AND NOT EXISTS (
             SELECT 1 FROM periodos_nomina pn
             WHERE pn.nomina_id = f.nomina_id AND pn.fecha_hasta = f.fecha_pago
           )
       )
       SELECT f.nomina_id, f.nombre, f.fecha_pago,
              COALESCE(SUM(e.salario_base_usd), 0) AS total_usd
       FROM filtradas f
       LEFT JOIN empleado_nominas en ON en.nomina_id = f.nomina_id
       LEFT JOIN empleados e ON e.id = en.empleado_id AND e.activo = TRUE
       GROUP BY f.nomina_id, f.nombre, f.fecha_pago
       ORDER BY f.fecha_pago ASC`,
      [desde, hasta]
    );
    nominasEstimadas = r.rows.map((row) => ({
      nomina_id: Number(row.nomina_id),
      nombre: String(row.nombre),
      fecha_pago: toDate(row.fecha_pago),
      total_usd: Number(row.total_usd ?? 0),
    }));
  } catch { /* skip if table missing */ }

  // Query 2: mensuales y quincenales automáticas
  try {
    const r = await pool.query<{ nomina_id: string; nombre: string; fecha_pago: unknown; total_salario: string; total_inc_usd: string; nro_empleados: string }>(
      `WITH meses AS (
         SELECT generate_series(
           date_trunc('month', $1::date),
           date_trunc('month', $2::date),
           '1 month'::interval
         )::date AS mes_inicio
       ),
       fechas AS (
         SELECT n.id AS nomina_id, n.nombre,
                (m.mes_inicio + (n.dia_pago_1 - 1) * INTERVAL '1 day')::date AS fecha_pago
         FROM meses m, nominas n
         WHERE n.activo = TRUE AND n.modo_generacion = 'AUTOMATICO'
           AND n.frecuencia IN ('MENSUAL','QUINCENAL') AND n.dia_pago_1 IS NOT NULL
         UNION ALL
         SELECT n.id, n.nombre,
                (m.mes_inicio + (n.dia_pago_2 - 1) * INTERVAL '1 day')::date AS fecha_pago
         FROM meses m, nominas n
         WHERE n.activo = TRUE AND n.modo_generacion = 'AUTOMATICO'
           AND n.frecuencia = 'QUINCENAL' AND n.dia_pago_2 IS NOT NULL
       ),
       filtradas AS (
         SELECT DISTINCT f.nomina_id, f.nombre, f.fecha_pago
         FROM fechas f
         WHERE f.fecha_pago BETWEEN $1 AND $2
           AND NOT EXISTS (
             SELECT 1 FROM periodos_nomina pn
             WHERE pn.nomina_id = f.nomina_id AND pn.fecha_hasta = f.fecha_pago
           )
       ),
       salarios AS (
         SELECT en.nomina_id,
                COALESCE(SUM(e.salario_base_usd), 0) AS total_salario,
                COUNT(DISTINCT en.empleado_id) AS nro_empleados
         FROM empleado_nominas en
         JOIN empleados e ON e.id = en.empleado_id AND e.activo = TRUE
         GROUP BY en.nomina_id
       ),
       incidencias AS (
         SELECT nic.nomina_id, COALESCE(SUM(nic.monto_usd), 0) AS total_inc_usd
         FROM nomina_incidencia_config nic
         GROUP BY nic.nomina_id
       )
       SELECT f.nomina_id, f.nombre, f.fecha_pago,
              COALESCE(s.total_salario, 0) AS total_salario,
              COALESCE(ic.total_inc_usd, 0) AS total_inc_usd,
              COALESCE(s.nro_empleados, 0) AS nro_empleados
       FROM filtradas f
       LEFT JOIN salarios s ON s.nomina_id = f.nomina_id
       LEFT JOIN incidencias ic ON ic.nomina_id = f.nomina_id
       ORDER BY f.fecha_pago ASC`,
      [desde, hasta]
    );
    for (const row of r.rows) {
      const nro = Number(row.nro_empleados);
      const totalUsd = Number(row.total_salario) + Number(row.total_inc_usd) * nro;
      nominasEstimadas.push({
        nomina_id: Number(row.nomina_id),
        nombre: String(row.nombre),
        fecha_pago: toDate(row.fecha_pago),
        total_usd: totalUsd,
      });
    }
  } catch { /* skip if table missing */ }

  // ── KPI: pagado este mes ───────────────────────────────────────────────────
  let gastosPagadoUsd = 0;
  let nominasPagadoUsd = 0;
  try {
    const r = await pool.query<{ total_bs: string; tasa_avg: string }>(
      `SELECT COALESCE(SUM(monto_bs), 0) AS total_bs,
              COALESCE(AVG(NULLIF(tasa_dia, 0)), 1) AS tasa_avg
       FROM gastos WHERE estado = 'PAGADO' AND fecha >= $1`,
      [mesInicio]
    );
    gastosPagadoUsd =
      Number(r.rows[0]?.total_bs ?? 0) / Math.max(1, Number(r.rows[0]?.tasa_avg ?? 1));
  } catch { /* skip */ }

  try {
    const r = await pool.query<{ total_usd: string }>(
      `SELECT COALESCE(SUM(np.salario_base_bs / NULLIF(pn.tasa_dia, 0)), 0) AS total_usd
       FROM nomina_pagos np
       JOIN periodos_nomina pn ON pn.id = np.periodo_id
       WHERE np.estado = 'PAGADO' AND np.pagado_at >= $1`,
      [mesInicio]
    );
    nominasPagadoUsd = Number(r.rows[0]?.total_usd ?? 0);
  } catch { /* skip */ }

  // ── Merge + enrich ─────────────────────────────────────────────────────────
  const allRaw = [...nominaRows, ...gastoRows];

  type Item = {
    id: string; tipo: string; descripcion: string;
    fechaVencimiento: string; montoBs: number; montoUsd: number;
    estado: "vencido" | "pendiente" | "programado"; referencia: string | null;
    estimado?: boolean;
  };

  const items: Item[] = allRaw.map((r) => {
    const montoBs = Number(r.monto_bs);
    const tasaDia = Number(r.tasa_dia);
    const montoUsd = tasaDia > 0 ? montoBs / tasaDia : 0;
    const fechaVenc = toDate(r.fecha_vencimiento);
    let estado: "vencido" | "pendiente" | "programado";
    if (fechaVenc < hoy) estado = "vencido";
    else if (fechaVenc <= domingo) estado = "pendiente";
    else estado = "programado";
    return { id: r.id, tipo: r.tipo, descripcion: r.descripcion, fechaVencimiento: fechaVenc, montoBs, montoUsd, estado, referencia: r.referencia ?? null };
  });

  // Agregar nóminas estimadas (sin período generado) como ítems virtuales
  for (const ne of nominasEstimadas) {
    const fechaVenc = ne.fecha_pago;
    let estado: "vencido" | "pendiente" | "programado";
    if (fechaVenc < hoy) estado = "vencido";
    else if (fechaVenc <= domingo) estado = "pendiente";
    else estado = "programado";
    items.push({
      id: `NE${ne.nomina_id}_${fechaVenc}`,
      tipo: "nomina",
      descripcion: `${ne.nombre} · estimado ${fechaVenc.slice(8, 10)}/${fechaVenc.slice(5, 7)}/${fechaVenc.slice(0, 4)}`,
      fechaVencimiento: fechaVenc,
      montoBs: 0,
      montoUsd: ne.total_usd,
      estado,
      referencia: null,
      estimado: true,
    });
  }

  // Sort merged list by date
  items.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const vencidoUsd = items.filter((i) => i.estado === "vencido").reduce((s, i) => s + i.montoUsd, 0);
  const estaSemanaUsd = items
    .filter((i) => i.fechaVencimiento >= lunes && i.fechaVencimiento <= domingo)
    .reduce((s, i) => s + i.montoUsd, 0);
  const lunesProx = addDays(lunes, 7);
  const domingoProx = addDays(lunes, 13);
  const proximaSemanaUsd = items
    .filter((i) => i.fechaVencimiento >= lunesProx && i.fechaVencimiento <= domingoProx)
    .reduce((s, i) => s + i.montoUsd, 0);
  const esteMesUsd = items.reduce((s, i) => s + i.montoUsd, 0);
  const pagadoUsd = gastosPagadoUsd + nominasPagadoUsd;

  // ── Semanas timeline (4 semanas a partir del lunes actual) ────────────────
  const semanas = Array.from({ length: 4 }, (_, i) => {
    const semLunes = addDays(lunes, i * 7);
    const semDomingo = addDays(semLunes, 6);
    const semItems = items.filter(
      (it) => it.fechaVencimiento >= semLunes && it.fechaVencimiento <= semDomingo
    );
    const totalUsd = semItems.reduce((s, it) => s + it.montoUsd, 0);
    const tipos = [...new Set(semItems.map((it) => it.tipo))];
    return { lunes: semLunes, domingo: semDomingo, totalUsd, tipos };
  });

  return NextResponse.json({
    kpis: { vencidoUsd, estaSemanaUsd, proximaSemanaUsd, esteMesUsd, pagadoUsd },
    items,
    semanas,
    hoy,
    lunes,
    domingo,
    lunesProx,
    domingoProx,
  });
}

// PATCH — marcar obligación como pagada (gasto o nómina completa)
export async function PATCH(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json()) as { id: string };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Gasto operativo
  if (body.id.startsWith("G")) {
    const gastoId = Number(body.id.slice(1));
    await pool.query(
      `UPDATE gastos SET estado = 'PAGADO', pagado_at = now() WHERE id = $1`,
      [gastoId]
    );
    return NextResponse.json({ ok: true });
  }

  // Período de nómina — marcar todos los pagos pendientes de ese período
  if (body.id.startsWith("N")) {
    const periodoId = Number(body.id.slice(1));
    const pendientesResult = await pool.query<{ id: number }>(
      `SELECT id FROM nomina_pagos WHERE periodo_id = $1 AND estado = 'PENDIENTE'`,
      [periodoId]
    );
    if (pendientesResult.rows.length === 0) {
      return NextResponse.json({ ok: true, mensaje: "Sin pagos pendientes" });
    }
    const ids = pendientesResult.rows.map((r) => r.id);
    await pool.query(
      `UPDATE nomina_pagos SET estado = 'PAGADO', pagado_at = now() WHERE id = ANY($1::int[])`,
      [ids]
    );
    return NextResponse.json({ ok: true, marcados: ids.length });
  }

  return NextResponse.json({ error: "ID no reconocido" }, { status: 400 });
}

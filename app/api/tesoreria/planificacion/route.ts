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
  const dow = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
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

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = hoyCaracas();
  const lunes = lunesDeHoy(hoy);
  const domingo = addDays(lunes, 6);
  const desde = addDays(hoy, -28);
  const hasta = addDays(hoy, 28);
  const mesInicio = inicioMes(hoy);

  // ── Items pendientes/vencidos ──────────────────────────────────────────────
  const itemsResult = await pool.query<{
    id: string;
    tipo: string;
    descripcion: string;
    fecha_vencimiento: unknown;
    monto_bs: string;
    tasa_dia: string;
    referencia: string | null;
  }>(
    `
    -- Nóminas con pagos pendientes
    SELECT
      'N' || pn.id                                AS id,
      'nomina'                                    AS tipo,
      n.nombre || ' · ' || TO_CHAR(pn.fecha_desde,'DD/MM') || '–' || TO_CHAR(pn.fecha_hasta,'DD/MM/YYYY') AS descripcion,
      pn.fecha_hasta                              AS fecha_vencimiento,
      COALESCE(SUM(np.monto_bs), 0)               AS monto_bs,
      pn.tasa_dia                                 AS tasa_dia,
      NULL::text                                  AS referencia
    FROM periodos_nomina pn
    JOIN nominas n ON n.id = pn.nomina_id
    JOIN nomina_pagos np ON np.periodo_id = pn.id AND np.estado = 'PENDIENTE'
    WHERE pn.fecha_hasta BETWEEN $1 AND $2
    GROUP BY pn.id, n.nombre, pn.fecha_desde, pn.fecha_hasta, pn.tasa_dia
    HAVING COALESCE(SUM(np.monto_bs), 0) > 0

    UNION ALL

    -- Gastos operativos pendientes
    SELECT
      'G' || g.id                                 AS id,
      CASE WHEN g.recurrente THEN 'gasto-fijo' ELSE 'gasto' END AS tipo,
      COALESCE(tg.nombre, g.tipo::text) || ' · ' || g.proveedor AS descripcion,
      g.fecha                                     AS fecha_vencimiento,
      g.monto_bs                                  AS monto_bs,
      g.tasa_dia                                  AS tasa_dia,
      g.numero_factura                            AS referencia
    FROM gastos g
    LEFT JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id
    WHERE g.estado = 'PENDIENTE'
      AND g.fecha BETWEEN $1 AND $2

    ORDER BY fecha_vencimiento ASC
    `,
    [desde, hasta]
  );

  // ── Pagado este mes (KPI only) ─────────────────────────────────────────────
  const pagadoMesResult = await pool.query<{ total_bs: string; tasa_avg: string }>(
    `SELECT COALESCE(SUM(monto_bs), 0) AS total_bs, COALESCE(AVG(NULLIF(tasa_dia,0)), 1) AS tasa_avg
     FROM gastos
     WHERE estado = 'PAGADO' AND fecha >= $1`,
    [mesInicio]
  );

  const pagadoNominaResult = await pool.query<{ total_usd: string }>(
    `SELECT COALESCE(SUM(np.monto_bs / NULLIF(pn.tasa_dia, 0)), 0) AS total_usd
     FROM nomina_pagos np
     JOIN periodos_nomina pn ON pn.id = np.periodo_id
     WHERE np.estado = 'PAGADO' AND np.pagado_at >= $1`,
    [mesInicio]
  );

  // ── Map items ──────────────────────────────────────────────────────────────
  const items = itemsResult.rows.map((r) => {
    const montoBs = Number(r.monto_bs);
    const tasaDia = Number(r.tasa_dia);
    const montoUsd = tasaDia > 0 ? montoBs / tasaDia : 0;
    const fechaVenc = toDate(r.fecha_vencimiento);
    let estado: "vencido" | "pendiente" | "programado";
    if (fechaVenc < hoy) estado = "vencido";
    else if (fechaVenc <= domingo) estado = "pendiente";
    else estado = "programado";
    return {
      id: r.id,
      tipo: r.tipo,
      descripcion: r.descripcion,
      fechaVencimiento: fechaVenc,
      montoBs,
      montoUsd,
      estado,
      referencia: r.referencia ?? null,
    };
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const vencidoUsd = items.filter((i) => i.estado === "vencido").reduce((s, i) => s + i.montoUsd, 0);
  const estaSemanaUsd = items
    .filter((i) => i.fechaVencimiento >= lunes && i.fechaVencimiento <= domingo)
    .reduce((s, i) => s + i.montoUsd, 0);
  const esteMesUsd = items.reduce((s, i) => s + i.montoUsd, 0); // all items in window ≈ within month
  const gastosPagadoUsd =
    Number(pagadoMesResult.rows[0]?.total_bs ?? 0) /
    Math.max(1, Number(pagadoMesResult.rows[0]?.tasa_avg ?? 1));
  const nominasPagadoUsd = Number(pagadoNominaResult.rows[0]?.total_usd ?? 0);
  const pagadoUsd = gastosPagadoUsd + nominasPagadoUsd;

  // ── Semanas timeline (4 weeks from lunes) ─────────────────────────────────
  const semanas = Array.from({ length: 4 }, (_, i) => {
    const semLunes = addDays(lunes, i * 7);
    const semDomingo = addDays(semLunes, 6);
    const totalUsd = items
      .filter((it) => it.fechaVencimiento >= semLunes && it.fechaVencimiento <= semDomingo)
      .reduce((s, it) => s + it.montoUsd, 0);
    return { lunes: semLunes, domingo: semDomingo, totalUsd };
  });

  return NextResponse.json({
    kpis: { vencidoUsd, estaSemanaUsd, esteMesUsd, pagadoUsd },
    items,
    semanas,
    hoy,
    lunes,
    domingo,
  });
}

// PATCH /api/tesoreria/planificacion — mark a gasto as pagado
export async function PATCH(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await request.json()) as { id: string };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  if (body.id.startsWith("G")) {
    const gastoId = Number(body.id.slice(1));
    await pool.query(
      `UPDATE gastos SET estado = 'PAGADO', pagado_at = now() WHERE id = $1`,
      [gastoId]
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Solo gastos pueden marcarse directamente desde aquí" }, { status: 400 });
}

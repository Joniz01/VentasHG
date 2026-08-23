import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import { generarPeriodoNomina } from "@/lib/nomina-periodos";
import type { FrecuenciaIncidencia } from "@/lib/types";

function mapPeriodo(row: Record<string, unknown>, pagosRows: Record<string, unknown>[], incidenciasRows: Record<string, unknown>[]) {
  const pagos = pagosRows
    .filter((p) => p.periodo_id === row.id)
    .map((p) => {
      const incidencias = incidenciasRows
        .filter((i) => i.nomina_pago_id === p.id)
        .map((i) => ({
          id: i.id,
          tipoIncidenciaId: i.tipo_incidencia_id,
          tipoIncidenciaNombre: i.tipo_incidencia_nombre,
          frecuencia: i.frecuencia as FrecuenciaIncidencia | null,
          montoBs: Number(i.monto_bs),
        }));
      const salarioBaseBs = Number(p.salario_base_bs);
      const totalIncidenciasBs = incidencias.reduce((s, i) => s + i.montoBs, 0);
      const totalBs = salarioBaseBs + totalIncidenciasBs;
      const tasaDia = Number(row.tasa_dia);
      return {
        id: p.id,
        empleadoId: p.empleado_id,
        empleadoNombre: p.empleado_nombre,
        salarioBaseBs,
        incidencias,
        totalIncidenciasBs,
        totalBs,
        totalUsd: tasaDia > 0 ? totalBs / tasaDia : 0,
        estado: p.estado,
        pagadoAt: p.pagado_at,
      };
    });

  const totalGeneralBs = pagos.reduce((s, p) => s + p.totalBs, 0);
  const totalGeneralUsd = pagos.reduce((s, p) => s + p.totalUsd, 0);

  return {
    id: row.id,
    nominaId: row.nomina_id,
    nominaNombre: row.nomina_nombre,
    frecuencia: row.frecuencia,
    fechaDesde: row.fecha_desde instanceof Date ? row.fecha_desde.toISOString().slice(0, 10) : String(row.fecha_desde).slice(0, 10),
    fechaHasta: row.fecha_hasta instanceof Date ? row.fecha_hasta.toISOString().slice(0, 10) : String(row.fecha_hasta).slice(0, 10),
    tasaDia: Number(row.tasa_dia),
    estado: row.estado,
    pagos,
    totalGeneralBs,
    totalGeneralUsd,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const nominaId = searchParams.get("nominaId");
  const soloPendientes = searchParams.get("pendientes") === "true";

  try {
    const conditions: string[] = [];
    const vals: unknown[] = [];
    if (nominaId) { conditions.push(`pn.nomina_id = $${vals.length + 1}`); vals.push(nominaId); }
    if (soloPendientes) {
      conditions.push(`EXISTS (SELECT 1 FROM nomina_pagos np2 WHERE np2.periodo_id = pn.id AND np2.estado = 'PENDIENTE')`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const periodosResult = await pool.query(
      `SELECT pn.*, n.nombre AS nomina_nombre
       FROM periodos_nomina pn
       LEFT JOIN nominas n ON n.id = pn.nomina_id
       ${where}
       ORDER BY pn.fecha_desde DESC, pn.id DESC`,
      vals
    );
    const periodoIds = periodosResult.rows.map((r) => r.id);

    const pagosResult = periodoIds.length
      ? await pool.query(
          `SELECT np.*, CONCAT(e.nombre, CASE WHEN e.apellido IS NOT NULL THEN ' ' || e.apellido ELSE '' END) AS empleado_nombre
           FROM nomina_pagos np
           JOIN empleados e ON e.id = np.empleado_id
           WHERE np.periodo_id = ANY($1::int[])
           ORDER BY e.nombre ASC`,
          [periodoIds]
        )
      : { rows: [] };

    const pagoIds = pagosResult.rows.map((r) => r.id);

    const incidenciasResult = pagoIds.length
      ? await pool.query(
          `SELECT ni.*, ti.nombre AS tipo_incidencia_nombre
           FROM nomina_incidencias ni
           JOIN tipos_incidencia ti ON ti.id = ni.tipo_incidencia_id
           WHERE ni.nomina_pago_id = ANY($1::int[])`,
          [pagoIds]
        )
      : { rows: [] };

    const periodos = periodosResult.rows.map((r) => mapPeriodo(r, pagosResult.rows, incidenciasResult.rows));

    return NextResponse.json({ periodos });
  } catch {
    return NextResponse.json({ periodos: [] });
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as {
    nominaId?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    tasaDia?: number;
  };

  if (!body.nominaId || !body.fechaDesde || !body.fechaHasta) {
    return NextResponse.json({ error: "Nómina y fechas son obligatorias" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const periodoId = await generarPeriodoNomina(client, {
      nominaId: body.nominaId,
      fechaDesde: body.fechaDesde,
      fechaHasta: body.fechaHasta,
      tasaDia: Number(body.tasaDia) || 0,
      createdBy: sesion.id,
    });

    await client.query("COMMIT");
    return NextResponse.json({ id: periodoId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error && err.message === "Nómina no encontrada" ? err.message : "Error al crear el período de nómina";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

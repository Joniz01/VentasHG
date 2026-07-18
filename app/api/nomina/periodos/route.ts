import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { FrecuenciaIncidencia, FrecuenciaRecurrencia, PeriodoIncidenciaConfig } from "@/lib/types";

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

  try {
    const periodosResult = await pool.query(
      `SELECT * FROM periodos_nomina ORDER BY fecha_desde DESC, id DESC`
    );
    const periodoIds = periodosResult.rows.map((r) => r.id);

    const pagosResult = periodoIds.length
      ? await pool.query(
          `SELECT np.*, e.nombre AS empleado_nombre
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
    frecuencia?: FrecuenciaRecurrencia;
    fechaDesde?: string;
    fechaHasta?: string;
    tasaDia?: number;
    incidencias?: PeriodoIncidenciaConfig[];
  };

  if (!body.frecuencia || !body.fechaDesde || !body.fechaHasta) {
    return NextResponse.json({ error: "Frecuencia y fechas son obligatorias" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const periodoResult = await client.query(
      `INSERT INTO periodos_nomina (frecuencia, fecha_desde, fecha_hasta, tasa_dia, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [body.frecuencia, body.fechaDesde, body.fechaHasta, Number(body.tasaDia) || 0, sesion.id]
    );
    const periodoId = periodoResult.rows[0].id;

    const empleados = await client.query(
      `SELECT id, salario_base_bs FROM empleados WHERE activo = TRUE AND tipo_pago = $1`,
      [body.frecuencia]
    );

    const incidenciasConfig = (body.incidencias ?? []).filter((i) => i.tipoIncidenciaId);

    for (const emp of empleados.rows) {
      const pagoResult = await client.query(
        `INSERT INTO nomina_pagos (periodo_id, empleado_id, salario_base_bs)
         VALUES ($1,$2,$3)
         ON CONFLICT (periodo_id, empleado_id) DO NOTHING
         RETURNING id`,
        [periodoId, emp.id, emp.salario_base_bs]
      );

      const nominaPagoId = pagoResult.rows[0]?.id;
      if (!nominaPagoId) continue;

      for (const inc of incidenciasConfig) {
        await client.query(
          `INSERT INTO nomina_incidencias (nomina_pago_id, tipo_incidencia_id, monto_bs, frecuencia)
           VALUES ($1,$2,$3,$4)`,
          [nominaPagoId, inc.tipoIncidenciaId, Number(inc.montoBs) || 0, inc.frecuencia]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ id: periodoId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Error al crear el período de nómina" }, { status: 400 });
  } finally {
    client.release();
  }
}

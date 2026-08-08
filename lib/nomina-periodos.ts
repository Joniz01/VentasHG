import type { PoolClient } from "pg";
import type { FrecuenciaRecurrencia } from "@/lib/types";

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDiasIso(fechaIso: string, dias: number): string {
  const d = new Date(`${fechaIso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return toIso(d);
}

// Calcula la fecha "hasta" de un período dado su inicio y la frecuencia de la Nómina.
export function calcularFechaHastaPeriodo(frecuencia: FrecuenciaRecurrencia, fechaDesdeIso: string): string {
  const d = new Date(`${fechaDesdeIso}T00:00:00`);
  if (frecuencia === "SEMANAL") {
    d.setDate(d.getDate() + 6);
  } else if (frecuencia === "QUINCENAL") {
    d.setDate(d.getDate() + 14);
  } else {
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
  }
  return toIso(d);
}

// Sugiere el próximo rango de fechas para una Nómina, a partir del fin del
// último período generado (o desde hoy si nunca se ha generado uno).
export function sugerirProximoRango(
  frecuencia: FrecuenciaRecurrencia,
  ultimaFechaHasta: string | null,
  hoyIso: string
): { fechaDesde: string; fechaHasta: string } {
  const fechaDesde = ultimaFechaHasta ? addDiasIso(ultimaFechaHasta, 1) : hoyIso;
  const fechaHasta = calcularFechaHastaPeriodo(frecuencia, fechaDesde);
  return { fechaDesde, fechaHasta };
}

// Genera un período (corrida) de una Nómina: crea periodos_nomina, un
// nomina_pagos por cada empleado asignado (con salario 0 si la Nómina es
// "Solo Incidencias") y aplica las incidencias configuradas cuya fecha
// efectiva caiga dentro del rango (salvo que la Nómina sea "Solo Sueldo Base").
// Debe ejecutarse dentro de una transacción ya abierta (BEGIN) por el llamador.
export async function generarPeriodoNomina(
  client: PoolClient,
  params: { nominaId: number; fechaDesde: string; fechaHasta: string; tasaDia: number; createdBy: number | null }
): Promise<number> {
  const nominaResult = await client.query(
    `SELECT id, tipo, frecuencia FROM nominas WHERE id = $1 AND activo = TRUE`,
    [params.nominaId]
  );
  const nomina = nominaResult.rows[0];
  if (!nomina) {
    throw new Error("Nómina no encontrada");
  }

  const periodoResult = await client.query(
    `INSERT INTO periodos_nomina (nomina_id, frecuencia, fecha_desde, fecha_hasta, tasa_dia, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [params.nominaId, nomina.frecuencia, params.fechaDesde, params.fechaHasta, params.tasaDia, params.createdBy]
  );
  const periodoId = periodoResult.rows[0].id;

  const empleados = await client.query(
    `SELECT e.id, e.salario_base_bs
     FROM empleados e
     JOIN empleado_nominas en ON en.empleado_id = e.id
     WHERE e.activo = TRUE AND en.nomina_id = $1`,
    [params.nominaId]
  );

  const soloIncidencias = nomina.tipo === "SOLO_INCIDENCIAS";
  const soloSueldo = nomina.tipo === "SOLO_SUELDO";

  const incidenciasConfig = soloSueldo
    ? { rows: [] }
    : await client.query(
        `SELECT tipo_incidencia_id, frecuencia, monto_bs
         FROM nomina_incidencia_config
         WHERE nomina_id = $1 AND fecha_efectiva BETWEEN $2 AND $3`,
        [params.nominaId, params.fechaDesde, params.fechaHasta]
      );

  for (const emp of empleados.rows) {
    const pagoResult = await client.query(
      `INSERT INTO nomina_pagos (periodo_id, empleado_id, salario_base_bs)
       VALUES ($1,$2,$3)
       ON CONFLICT (periodo_id, empleado_id) DO NOTHING
       RETURNING id`,
      [periodoId, emp.id, soloIncidencias ? 0 : emp.salario_base_bs]
    );

    const nominaPagoId = pagoResult.rows[0]?.id;
    if (!nominaPagoId) continue;

    for (const inc of incidenciasConfig.rows) {
      await client.query(
        `INSERT INTO nomina_incidencias (nomina_pago_id, tipo_incidencia_id, monto_bs, frecuencia)
         VALUES ($1,$2,$3,$4)`,
        [nominaPagoId, inc.tipo_incidencia_id, Number(inc.monto_bs) || 0, inc.frecuencia]
      );
    }
  }

  return periodoId;
}

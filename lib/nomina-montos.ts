// Reglas de cuánto vale una nómina. Viven aquí y en ningún otro sitio: estaban
// copiadas en cuentas por pagar, gestión de pagos, el resumen de nómina y la
// planificación de tesorería, y cada copia se corrigió por separado.
//
// Las funciones sql* arman fragmentos de SQL a partir de NOMBRES DE COLUMNA
// escritos en el código. Nunca se les debe pasar valores que vengan del
// usuario: los datos viajan siempre como parámetros ($1, $2...) de la consulta.

// Una nómina puede pagar solo sueldo, solo incidencias, o ambos.
export type TipoNomina = "NORMAL" | "SOLO_SUELDO" | "SOLO_INCIDENCIAS";

// ─── Nómina todavía no generada: se estima según su tipo ─────────────────────
// Las incidencias se configuran por empleado, así que se multiplican por la
// cantidad de empleados; el salario ya viene sumado.

export function montoEstimadoUsd(p: {
  tipo: string | null | undefined;
  salarioUsd: number;
  incidenciaUsdPorEmpleado: number;
  nroEmpleados: number;
}): number {
  const salario = Number(p.salarioUsd) || 0;
  const incidencias = (Number(p.incidenciaUsdPorEmpleado) || 0) * (Number(p.nroEmpleados) || 0);
  const tipo = String(p.tipo ?? "NORMAL").trim();
  if (tipo === "SOLO_INCIDENCIAS") return incidencias;
  if (tipo === "SOLO_SUELDO") return salario;
  return salario + incidencias;
}

export function sqlMontoEstimadoUsd(col: {
  tipo: string;
  salarioUsd: string;
  incidenciaUsdPorEmpleado: string;
  nroEmpleados: string;
}): string {
  const incidencias = `(${col.incidenciaUsdPorEmpleado}) * (${col.nroEmpleados})`;
  return `CASE ${col.tipo}
            WHEN 'SOLO_INCIDENCIAS' THEN ${incidencias}
            WHEN 'SOLO_SUELDO'      THEN ${col.salarioUsd}
            ELSE (${col.salarioUsd}) + ${incidencias}
          END`;
}

// ─── Período ya generado: manda lo que quedó registrado en él ────────────────
// nomina_pagos.salario_base_bs es 0 cuando la nómina no paga sueldo base. El
// salario en USD del empleado solo se usa cuando el período sí lo registró, y
// únicamente para no perder precisión al convertir por tasa.

export function sqlSalarioBaseUsdDelPago(col: {
  salarioBaseBs: string;
  salarioUsdEmpleado: string;
}): string {
  return `CASE WHEN ${col.salarioBaseBs} > 0 THEN ${col.salarioUsdEmpleado} ELSE 0 END`;
}

export function salarioBaseUsdDelPago(p: {
  salarioBaseBs: number;
  salarioUsdEmpleado: number;
  tasaDia: number;
}): number {
  if (!(p.salarioBaseBs > 0)) return 0;
  return Number(p.salarioUsdEmpleado) || (p.tasaDia > 0 ? p.salarioBaseBs / p.tasaDia : 0);
}

// Incidencias de un período, en bolívares, como subconsulta correlacionada.
// Se resuelve aparte de la suma de salarios porque un empleado puede tener
// varias incidencias y un JOIN directo multiplicaría los salarios.
export function sqlIncidenciasDelPeriodoBs(
  estadoPago: "PAGADO" | "PENDIENTE",
  aliasPeriodo = "pn"
): string {
  return `(
    SELECT SUM(ni.monto_bs)
    FROM nomina_incidencias ni
    JOIN nomina_pagos np2 ON np2.id = ni.nomina_pago_id AND np2.estado = '${estadoPago}'
    WHERE np2.periodo_id = ${aliasPeriodo}.id
  )`;
}

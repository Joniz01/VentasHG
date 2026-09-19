import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type DrillRow = { fecha: string; concepto: string; montoUsd: number; fuente: string };

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo") ?? "";
  const mes  = searchParams.get("mes") ?? "";

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "Parámetro mes inválido" }, { status: 400 });
  }

  const items: DrillRow[] = [];

  // ── Nómina ──────────────────────────────────────────────────────
  if (tipo === "nomina") {
    try {
      const r = await pool.query(
        `SELECT TO_CHAR(np.pagado_at AT TIME ZONE 'America/Caracas', 'YYYY-MM-DD') AS fecha,
                e.nombre || ' ' || e.apellido AS concepto,
                e.salario_base_usd AS monto_usd
         FROM nomina_pagos np
         JOIN empleados e ON e.id = np.empleado_id
         WHERE np.estado = 'PAGADO'
           AND TO_CHAR(np.pagado_at, 'YYYY-MM') = $1
         ORDER BY np.pagado_at, e.apellido`,
        [mes]
      );
      for (const row of r.rows) {
        items.push({ fecha: String(row.fecha).slice(0, 10), concepto: row.concepto, montoUsd: Number(row.monto_usd), fuente: "Nómina" });
      }
    } catch { /* skip */ }
  }

  // ── Gastos Operativos ────────────────────────────────────────────
  if (tipo === "opex") {
    // 1) Tabla gastos
    try {
      const r = await pool.query(
        `SELECT TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
                COALESCE(descripcion, proveedor, 'Gasto') AS concepto,
                ROUND(monto_bs / NULLIF(tasa_dia, 0), 2) AS monto_usd
         FROM gastos
         WHERE estado = 'PAGADO'
           AND TO_CHAR(fecha, 'YYYY-MM') = $1
         ORDER BY fecha`,
        [mes]
      );
      for (const row of r.rows) {
        items.push({ fecha: String(row.fecha).slice(0, 10), concepto: row.concepto, montoUsd: Number(row.monto_usd), fuente: "Gastos" });
      }
    } catch { /* skip */ }

    // 2) Abonos en historial CxP
    try {
      const r = await pool.query(
        `SELECT TO_CHAR(cph.fecha_pago, 'YYYY-MM-DD') AS fecha,
                COALESCE(cph.nota, cp.descripcion, cp.proveedor, 'Abono CxP') AS concepto,
                cph.monto_usd
         FROM cuentas_pagar_historial cph
         JOIN cuentas_pagar cp ON cp.id = cph.cuenta_pagar_id
         WHERE TO_CHAR(cph.fecha_pago, 'YYYY-MM') = $1
         ORDER BY cph.fecha_pago`,
        [mes]
      );
      for (const row of r.rows) {
        items.push({ fecha: String(row.fecha).slice(0, 10), concepto: row.concepto, montoUsd: Number(row.monto_usd), fuente: "CxP (abono)" });
      }
    } catch { /* tabla historial no disponible */ }

    // 3) Pagos CxP únicos sin historial
    try {
      const r = await pool.query(
        `SELECT TO_CHAR(cp.pagado_at, 'YYYY-MM-DD') AS fecha,
                COALESCE(cp.descripcion, cp.proveedor, 'Pago CxP') AS concepto,
                cp.monto_usd
         FROM cuentas_pagar cp
         WHERE cp.estado = 'PAGADO'
           AND cp.pagado_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM cuentas_pagar_historial cph WHERE cph.cuenta_pagar_id = cp.id)
           AND TO_CHAR(cp.pagado_at, 'YYYY-MM') = $1
         ORDER BY cp.pagado_at`,
        [mes]
      );
      for (const row of r.rows) {
        items.push({ fecha: String(row.fecha).slice(0, 10), concepto: row.concepto, montoUsd: Number(row.monto_usd), fuente: "CxP (pago único)" });
      }
    } catch { /* skip */ }
  }

  // ── COGS (compras) ───────────────────────────────────────────────
  if (tipo === "cogs") {
    try {
      const r = await pool.query(
        `SELECT TO_CHAR(c.fecha, 'YYYY-MM-DD') AS fecha,
                COALESCE(ci.nombre_producto, c.proveedor_nombre, 'Compra') AS concepto,
                ROUND(ci.subtotal_bs / NULLIF(c.tasa_dia, 0), 2) AS monto_usd,
                COALESCE(ci.tipo_uso, c.tipo_uso, 'MATERIA_PRIMA') AS tipo_uso
         FROM compras c
         JOIN compra_items ci ON ci.compra_id = c.id
         WHERE c.estado = 'ACTIVA'
           AND TO_CHAR(c.fecha, 'YYYY-MM') = $1
         ORDER BY c.fecha, ci.id`,
        [mes]
      );
      for (const row of r.rows) {
        items.push({
          fecha: String(row.fecha).slice(0, 10),
          concepto: row.concepto,
          montoUsd: Number(row.monto_usd),
          fuente: row.tipo_uso === "MATERIA_PRIMA" ? "Mat. Prima" : "Para Venta",
        });
      }
    } catch { /* skip */ }
  }

  // ── Cortesías ────────────────────────────────────────────────────
  if (tipo === "cortesias") {
    try {
      const r = await pool.query(
        `SELECT TO_CHAR(sg.fecha, 'YYYY-MM-DD') AS fecha,
                COALESCE(sg.motivo, sg.descripcion, 'Cortesía') AS concepto,
                ROUND(COALESCE(SUM(sgi.cantidad * sgi.costo), 0), 2) AS monto_usd
         FROM salidas_gratuitas sg
         LEFT JOIN salidas_gratuitas_items sgi ON sgi.salida_id = sg.id
         WHERE TO_CHAR(sg.fecha, 'YYYY-MM') = $1
         GROUP BY sg.id, sg.fecha, sg.motivo, sg.descripcion
         ORDER BY sg.fecha`,
        [mes]
      );
      for (const row of r.rows) {
        items.push({ fecha: String(row.fecha).slice(0, 10), concepto: row.concepto, montoUsd: Number(row.monto_usd), fuente: "Cortesía" });
      }
    } catch { /* skip */ }
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha));

  return NextResponse.json({ tipo, mes, items, total: items.reduce((s, r) => s + r.montoUsd, 0) });
}

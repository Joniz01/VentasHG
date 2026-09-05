import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toYM(date: Date | string): string {
  return String(date).slice(0, 7);
}

function mesLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${meses[parseInt(m) - 1]} ${y.slice(2)}`;
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(request.url);
  // Default: current month in Caracas time
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
  const mesParam = url.searchParams.get("mes") ?? hoy.slice(0, 7); // YYYY-MM

  // Build last 6 months for trend
  const meses: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(`${mesParam}-01`);
    d.setMonth(d.getMonth() - i);
    meses.push(d.toISOString().slice(0, 7));
  }

  const mesActual = meses[meses.length - 1];
  const mesAnterior = meses[meses.length - 2];

  // ── Ingresos por mes (venta_items.precio_unit ya en USD + delivery) ────
  // ventas no tiene columna tipo; todas las filas en ventas son ventas reales
  let ingresosRows: { mes: string; total_usd: string }[] = [];
  let _errIngresos = "";
  try {
    const r = await pool.query<{ mes: string; total_usd: string }>(
      `SELECT TO_CHAR(v.fecha, 'YYYY-MM') AS mes,
              ROUND(COALESCE(SUM(COALESCE(vi.cantidad * vi.precio_unit, 0)), 0)::numeric, 2) AS total_usd
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       WHERE TO_CHAR(v.fecha, 'YYYY-MM') = ANY($1::text[])
       GROUP BY TO_CHAR(v.fecha, 'YYYY-MM')
       ORDER BY 1`,
      [meses]
    );
    ingresosRows = r.rows;
  } catch (e) { _errIngresos = String(e); }

  // ── COGS (compras activas) por mes, separado por tipo_uso ─────────
  type CogsRow = { mes: string; tipo_uso: string; total_usd: string };
  let cogsRows: { mes: string; total_usd: string }[] = [];
  let cogsMpRows: { mes: string; total_usd: string }[] = [];
  let cogsVentaRows: { mes: string; total_usd: string }[] = [];
  try {
    const r = await pool.query<CogsRow>(
      `SELECT TO_CHAR(c.fecha, 'YYYY-MM') AS mes,
              COALESCE(ci.tipo_uso, c.tipo_uso, 'MATERIA_PRIMA') AS tipo_uso,
              ROUND(COALESCE(SUM(ci.subtotal_bs / NULLIF(c.tasa_dia, 0)), 0)::numeric, 2) AS total_usd
       FROM compras c
       JOIN compra_items ci ON ci.compra_id = c.id
       WHERE c.estado = 'ACTIVA'
         AND TO_CHAR(c.fecha, 'YYYY-MM') = ANY($1::text[])
       GROUP BY TO_CHAR(c.fecha, 'YYYY-MM'), COALESCE(ci.tipo_uso, c.tipo_uso, 'MATERIA_PRIMA')
       ORDER BY mes`,
      [meses]
    );
    // Agregar por mes para el total y por tipo_uso para el desglose
    const totMap: Record<string, number> = {};
    const mpMap: Record<string, number> = {};
    const vtMap: Record<string, number> = {};
    for (const row of r.rows) {
      const v = Number(row.total_usd);
      totMap[row.mes] = (totMap[row.mes] ?? 0) + v;
      if (row.tipo_uso === "MATERIA_PRIMA") mpMap[row.mes] = (mpMap[row.mes] ?? 0) + v;
      else vtMap[row.mes] = (vtMap[row.mes] ?? 0) + v;
    }
    cogsRows     = Object.entries(totMap).map(([mes, v]) => ({ mes, total_usd: String(v) }));
    cogsMpRows   = Object.entries(mpMap).map(([mes, v]) => ({ mes, total_usd: String(v) }));
    cogsVentaRows= Object.entries(vtMap).map(([mes, v]) => ({ mes, total_usd: String(v) }));
  } catch { /* skip */ }

  // ── Nómina pagada por mes ────────────────────────────────────────
  let nominaRows: { mes: string; total_usd: string }[] = [];
  try {
    const r = await pool.query<{ mes: string; total_usd: string }>(
      `SELECT TO_CHAR(np.pagado_at, 'YYYY-MM') AS mes,
              COALESCE(SUM(np.salario_base_bs / NULLIF(pn.tasa_dia, 0)), 0) AS total_usd
       FROM nomina_pagos np
       JOIN periodos_nomina pn ON pn.id = np.periodo_id
       WHERE np.estado = 'PAGADO'
         AND TO_CHAR(np.pagado_at, 'YYYY-MM') = ANY($1::text[])
       GROUP BY mes
       ORDER BY mes`,
      [meses]
    );
    nominaRows = r.rows;
  } catch { /* skip */ }

  // ── Gastos operativos por mes: gastos pagados + pagos CxP ───────
  const opexMap2: Record<string, number> = {};

  // 1) Tabla gastos (todos los pagados, no solo recurrentes)
  try {
    const r = await pool.query<{ mes: string; total_usd: string }>(
      `SELECT TO_CHAR(fecha, 'YYYY-MM') AS mes,
              COALESCE(SUM(monto_bs / NULLIF(tasa_dia, 0)), 0) AS total_usd
       FROM gastos
       WHERE estado = 'PAGADO'
         AND TO_CHAR(fecha, 'YYYY-MM') = ANY($1::text[])
       GROUP BY mes`,
      [meses]
    );
    for (const row of r.rows) opexMap2[row.mes] = (opexMap2[row.mes] ?? 0) + Number(row.total_usd);
  } catch { /* skip */ }

  // 2) Abonos parciales y finales registrados en historial de CxP
  try {
    const r = await pool.query<{ mes: string; total_usd: string }>(
      `SELECT TO_CHAR(fecha_pago, 'YYYY-MM') AS mes,
              COALESCE(SUM(monto_usd), 0) AS total_usd
       FROM cuentas_pagar_historial
       WHERE TO_CHAR(fecha_pago, 'YYYY-MM') = ANY($1::text[])
       GROUP BY mes`,
      [meses]
    );
    for (const row of r.rows) opexMap2[row.mes] = (opexMap2[row.mes] ?? 0) + Number(row.total_usd);
  } catch { /* tabla historial no disponible */ }

  // 3) Pagos de CxP hechos de una sola vez (sin historial)
  try {
    const r = await pool.query<{ mes: string; total_usd: string }>(
      `SELECT TO_CHAR(cp.pagado_at, 'YYYY-MM') AS mes,
              COALESCE(SUM(cp.monto_usd), 0) AS total_usd
       FROM cuentas_pagar cp
       WHERE cp.estado = 'PAGADO'
         AND cp.pagado_at IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM cuentas_pagar_historial cph WHERE cph.cuenta_pagar_id = cp.id
         )
         AND TO_CHAR(cp.pagado_at, 'YYYY-MM') = ANY($1::text[])
       GROUP BY mes`,
      [meses]
    );
    for (const row of r.rows) opexMap2[row.mes] = (opexMap2[row.mes] ?? 0) + Number(row.total_usd);
  } catch { /* skip */ }

  const opexRows: { mes: string; total_usd: string }[] = Object.entries(opexMap2).map(([mes, v]) => ({ mes, total_usd: String(v) }));

  // ── Cortesías/salidas gratuitas por mes (tabla salidas_gratuitas) ──
  let cortesiasRows: { mes: string; total_usd: string }[] = [];
  try {
    const r = await pool.query<{ mes: string; total_usd: string }>(
      `SELECT TO_CHAR(sg.fecha, 'YYYY-MM') AS mes,
              ROUND(COALESCE(SUM(COALESCE(sgi.cantidad * sgi.costo, 0)), 0)::numeric, 2) AS total_usd
       FROM salidas_gratuitas sg
       LEFT JOIN salidas_gratuitas_items sgi ON sgi.salida_id = sg.id
       WHERE TO_CHAR(sg.fecha, 'YYYY-MM') = ANY($1::text[])
       GROUP BY TO_CHAR(sg.fecha, 'YYYY-MM')
       ORDER BY 1`,
      [meses]
    );
    cortesiasRows = r.rows;
  } catch { /* skip */ }

  // ── Build per-month map ─────────────────────────────────────────
  function toMap(rows: { mes: string; total_usd: string }[]) {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.mes] = Number(r.total_usd);
    return m;
  }

  const ingMap    = toMap(ingresosRows);
  const cogsMap   = toMap(cogsRows);
  const cogsMpMap = toMap(cogsMpRows);
  const cogsVtMap = toMap(cogsVentaRows);
  const nomMap    = toMap(nominaRows);
  const opexMap   = toMap(opexRows);
  const cortMap   = toMap(cortesiasRows);

  const trend = meses.map((mes) => {
    const ingresos      = ingMap[mes]    ?? 0;
    const cogs          = cogsMap[mes]   ?? 0;
    const cogsMp        = cogsMpMap[mes] ?? 0;
    const cogsVenta     = cogsVtMap[mes] ?? 0;
    const nomina        = nomMap[mes]    ?? 0;
    const opex          = opexMap[mes]   ?? 0;
    const cortesias     = cortMap[mes]   ?? 0;
    const gananciaBruta = ingresos - cogs;
    const gastosOp      = nomina + opex + cortesias;
    const utilidad      = gananciaBruta - gastosOp;
    const margenBruto   = ingresos > 0 ? (gananciaBruta / ingresos) * 100 : 0;
    const margenNeto    = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
    return {
      mes,
      label: mesLabel(mes),
      ingresos, cogs, cogsMp, cogsVenta, nomina, opex, cortesias,
      gananciaBruta, gastosOp, utilidad,
      margenBruto: +margenBruto.toFixed(1),
      margenNeto:  +margenNeto.toFixed(1),
    };
  });

  const actual   = trend.find((t) => t.mes === mesActual)!;
  const anterior = trend.find((t) => t.mes === mesAnterior);

  function delta(a: number, b: number | undefined): number | null {
    if (!b || b === 0) return null;
    return +((a - b) / b * 100).toFixed(1);
  }

  // ── Días hábiles del mes actual ─────────────────────────────────
  let diasHabiles = 23;
  try {
    const [y, m] = mesActual.split("-").map(Number);
    const primerDia = new Date(y, m - 1, 1);
    const ultimoDia = new Date(y, m, 0);
    let count = 0;
    for (let d = new Date(primerDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    diasHabiles = count;
  } catch { /* use default */ }

  // ── Top productos por rentabilidad (mes actual) ─────────────────
  type ProductoRow = {
    nombre: string;
    cantidad: string;
    total_usd: string;
    costo_usd: string;
    margen_usd: string;
    margen_pct: string;
  };
  type ProductoSimpleRow = { nombre: string; cantidad: string; total_usd: string };
  let topProductos: { nombre: string; cantidad: number; totalUsd: number; costoUsd: number; margenUsd: number; margenPct: number }[] = [];
  try {
    // Intento principal: con costo_unit para calcular margen real
    const r = await pool.query<ProductoRow>(
      `SELECT p.nombre,
              ROUND(COALESCE(SUM(vi.cantidad), 0)::numeric, 2)                             AS cantidad,
              ROUND(COALESCE(SUM(vi.cantidad * vi.precio_unit), 0)::numeric, 2)             AS total_usd,
              ROUND(COALESCE(SUM(vi.cantidad * vi.costo_unit), 0)::numeric, 2)              AS costo_usd,
              ROUND(COALESCE(SUM(vi.cantidad * (vi.precio_unit - vi.costo_unit)), 0)::numeric, 2) AS margen_usd,
              CASE WHEN COALESCE(SUM(vi.cantidad * vi.precio_unit), 0) > 0
                   THEN ROUND((COALESCE(SUM(vi.cantidad * (vi.precio_unit - vi.costo_unit)), 0)
                        / SUM(vi.cantidad * vi.precio_unit) * 100)::numeric, 1)
                   ELSE 0 END                                                              AS margen_pct
       FROM venta_items vi
       JOIN ventas v ON v.id = vi.venta_id
       JOIN productos p ON p.id = vi.producto_id
       WHERE TO_CHAR(v.fecha, 'YYYY-MM') = $1
       GROUP BY p.id, p.nombre
       ORDER BY margen_usd DESC
       LIMIT 15`,
      [mesActual]
    );
    topProductos = r.rows.map((row) => ({
      nombre:    row.nombre,
      cantidad:  Number(row.cantidad),
      totalUsd:  Number(row.total_usd),
      costoUsd:  Number(row.costo_usd),
      margenUsd: Number(row.margen_usd),
      margenPct: Number(row.margen_pct),
    }));
  } catch {
    // Fallback: solo ingresos por producto si costo_unit no está disponible
    try {
      const r2 = await pool.query<ProductoSimpleRow>(
        `SELECT p.nombre,
                ROUND(COALESCE(SUM(vi.cantidad), 0)::numeric, 2) AS cantidad,
                ROUND(COALESCE(SUM(vi.cantidad * vi.precio_unit), 0)::numeric, 2) AS total_usd
         FROM venta_items vi
         JOIN ventas v ON v.id = vi.venta_id
         JOIN productos p ON p.id = vi.producto_id
         WHERE TO_CHAR(v.fecha, 'YYYY-MM') = $1
         GROUP BY p.id, p.nombre
         ORDER BY total_usd DESC
         LIMIT 15`,
        [mesActual]
      );
      topProductos = r2.rows.map((row) => ({
        nombre:    row.nombre,
        cantidad:  Number(row.cantidad),
        totalUsd:  Number(row.total_usd),
        costoUsd:  0,
        margenUsd: 0,
        margenPct: 0,
      }));
    } catch { /* venta_items no disponible */ }
  }

  // ── Ventas por semana del mes actual ─────────────────────────────
  type SemanaRow = { semana: string; total_usd: string; num_ventas: string };
  let ventasPorSemana: { semana: string; totalUsd: number; numVentas: number }[] = [];
  try {
    const r = await pool.query<SemanaRow>(
      `SELECT 'Semana ' || CEIL(EXTRACT(DAY FROM v.fecha) / 7.0)::int AS semana,
              ROUND(COALESCE(SUM(COALESCE(vi.cantidad * vi.precio_unit, 0)), 0)::numeric, 2) AS total_usd,
              COUNT(DISTINCT v.id)::text AS num_ventas
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       WHERE TO_CHAR(v.fecha, 'YYYY-MM') = $1
       GROUP BY CEIL(EXTRACT(DAY FROM v.fecha) / 7.0)
       ORDER BY 1`,
      [mesActual]
    );
    ventasPorSemana = r.rows.map((row) => ({
      semana:    row.semana,
      totalUsd:  Number(row.total_usd),
      numVentas: Number(row.num_ventas),
    }));
  } catch { /* skip */ }

  // ── Empleados activos (para ratio nómina/empleado) ────────────────
  let numEmpleados = 0;
  try {
    const r = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM empleados WHERE activo = true`
    );
    numEmpleados = Number(r.rows[0]?.total ?? 0);
  } catch { /* skip */ }

  // ── Inventario valorizado ─────────────────────────────────────────
  type InvRow = { nombre: string; stock: string; costo: string; valor: string; categoria: string };
  let inventario: { valorTotalUsd: number; productosConStock: number; productosSinStock: number; top10: { nombre: string; stock: number; costoUnit: number; valorUsd: number; categoria: string }[] } | null = null;
  try {
    const r = await pool.query<InvRow>(
      `SELECT p.nombre,
              ROUND(p.stock_actual::numeric, 2) AS stock,
              ROUND(p.costo::numeric, 2) AS costo,
              ROUND((p.stock_actual * p.costo)::numeric, 2) AS valor,
              COALESCE(c.nombre, 'Sin categoría') AS categoria
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.activo = true AND p.tipo_producto = 'NORMAL'
       ORDER BY (p.stock_actual * p.costo) DESC
       LIMIT 20`
    );
    const kpis = await pool.query<{ total_valor: string; con_stock: string; sin_stock: string }>(
      `SELECT ROUND(COALESCE(SUM(stock_actual * costo), 0)::numeric, 2) AS total_valor,
              COUNT(*) FILTER (WHERE stock_actual > 0)::text AS con_stock,
              COUNT(*) FILTER (WHERE stock_actual = 0)::text AS sin_stock
       FROM productos WHERE activo = true AND tipo_producto = 'NORMAL'`
    );
    inventario = {
      valorTotalUsd: Number(kpis.rows[0]?.total_valor ?? 0),
      productosConStock: Number(kpis.rows[0]?.con_stock ?? 0),
      productosSinStock: Number(kpis.rows[0]?.sin_stock ?? 0),
      top10: r.rows.map((row) => ({
        nombre: row.nombre,
        stock: Number(row.stock),
        costoUnit: Number(row.costo),
        valorUsd: Number(row.valor),
        categoria: row.categoria,
      })),
    };
  } catch { /* skip */ }

  return NextResponse.json({
    mes: mesActual,
    mesLabel: mesLabel(mesActual),
    meses,
    trend,
    actual: actual ?? {
      mes: mesActual, label: mesLabel(mesActual),
      ingresos: 0, cogs: 0, cogsMp: 0, cogsVenta: 0, nomina: 0, opex: 0, cortesias: 0,
      gananciaBruta: 0, gastosOp: 0, utilidad: 0, margenBruto: 0, margenNeto: 0,
    },
    anterior: anterior ?? null,
    deltas: {
      ingresos:     delta(actual?.ingresos ?? 0,     anterior?.ingresos),
      gananciaBruta:delta(actual?.gananciaBruta ?? 0,anterior?.gananciaBruta),
      gastosOp:     delta(actual?.gastosOp ?? 0,     anterior?.gastosOp),
      utilidad:     delta(actual?.utilidad ?? 0,     anterior?.utilidad),
      margenNeto:   anterior ? +((actual?.margenNeto ?? 0) - anterior.margenNeto).toFixed(1) : null,
    },
    diasHabiles,
    ingresoDiario: actual && diasHabiles > 0 ? +(actual.ingresos / diasHabiles).toFixed(0) : 0,
    // Contexto enriquecido para asesor IA
    topProductos,
    ventasPorSemana,
    numEmpleados,
    inventario,
  });
}

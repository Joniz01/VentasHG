import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta) {
    return NextResponse.json({ error: "Parámetros desde y hasta son requeridos" }, { status: 400 });
  }

  try {
    // Ventas del período (cobradas al contado + CxC cobradas en el período)
    const ventasResult = await pool.query(
      `SELECT
         COUNT(DISTINCT v.id)::int AS cantidad_ventas,
         COALESCE(SUM(vi.cantidad * vi.precio_unit), 0) AS ingresos_items,
         COALESCE(SUM(v.costo_delivery), 0) AS ingresos_delivery,
         COALESCE(SUM(vi.cantidad * vi.costo_unit), 0) AS costo_ventas
       FROM ventas v
       LEFT JOIN venta_items vi ON vi.venta_id = v.id
       WHERE
         (NOT v.cuenta_por_cobrar AND v.fecha BETWEEN $1 AND $2)
         OR (v.cuenta_cobrada = true AND v.cuenta_cobrada_at::date BETWEEN $1 AND $2)`,
      [desde, hasta]
    );

    // Costo de salidas no comerciales en el período, agrupadas por tipo
    const salidasResult = await pool.query(
      `SELECT
         sg.tipo,
         COUNT(DISTINCT sg.id)::int AS cantidad,
         COALESCE(SUM(sgi.cantidad * sgi.costo), 0) AS costo_total
       FROM salidas_gratuitas sg
       JOIN salidas_gratuitas_items sgi ON sgi.salida_id = sg.id
       WHERE sg.fecha BETWEEN $1 AND $2
         AND (sg.anulada IS NULL OR sg.anulada = FALSE)
       GROUP BY sg.tipo
       ORDER BY costo_total DESC`,
      [desde, hasta]
    );

    // Detalle por producto de las salidas no comerciales
    const detalleResult = await pool.query(
      `SELECT
         p.nombre AS producto,
         sg.tipo,
         SUM(sgi.cantidad) AS cantidad_total,
         SUM(sgi.cantidad * sgi.costo) AS costo_total
       FROM salidas_gratuitas sg
       JOIN salidas_gratuitas_items sgi ON sgi.salida_id = sg.id
       JOIN productos p ON p.id = sgi.producto_id
       WHERE sg.fecha BETWEEN $1 AND $2
         AND (sg.anulada IS NULL OR sg.anulada = FALSE)
       GROUP BY p.nombre, sg.tipo
       ORDER BY costo_total DESC
       LIMIT 20`,
      [desde, hasta]
    );

    const v = ventasResult.rows[0];
    const ingresosUsd = Number(v.ingresos_items) + Number(v.ingresos_delivery);
    const costoVentas = Number(v.costo_ventas);
    const margenBruto = ingresosUsd - costoVentas;

    const tipoLabels: Record<string, string> = {
      CORTESIA: "Cortesía",
      SORTEO: "Sorteo",
      CONSUMO_INTERNO: "Consumo interno",
      MUESTRA: "Consumo interno",
      EVENTO: "Evento",
      FIDELIDAD: "Fidelidad",
    };

    const salidas = salidasResult.rows.map((r) => ({
      tipo: r.tipo,
      label: tipoLabels[r.tipo] ?? r.tipo.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      cantidad: r.cantidad,
      costoTotal: Number(r.costo_total),
    }));

    const costoSalidasTotal = salidas.reduce((s, r) => s + r.costoTotal, 0);
    const rentabilidadOperativa = margenBruto - costoSalidasTotal;

    return NextResponse.json({
      desde,
      hasta,
      cantidadVentas: Number(v.cantidad_ventas),
      ingresosUsd,
      costoVentas,
      margenBruto,
      margenBrutoPct: ingresosUsd > 0 ? (margenBruto / ingresosUsd) * 100 : 0,
      salidas,
      costoSalidasTotal,
      costoSalidasPct: ingresosUsd > 0 ? (costoSalidasTotal / ingresosUsd) * 100 : 0,
      rentabilidadOperativa,
      rentabilidadOperativaPct: ingresosUsd > 0 ? (rentabilidadOperativa / ingresosUsd) * 100 : 0,
      detalle: detalleResult.rows.map((r) => ({
        producto: r.producto,
        tipo: tipoLabels[r.tipo] ?? r.tipo,
        cantidadTotal: Number(r.cantidad_total),
        costoTotal: Number(r.costo_total),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error interno" }, { status: 500 });
  }
}

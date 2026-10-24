import { NextResponse } from "next/server";
import { getResumenLocal } from "@/lib/resumen";
import { pool } from "@/lib/db";

const HOY = `(NOW() AT TIME ZONE 'America/Caracas')::date`;

export async function GET() {
  try {
    const [resumen, ayerRes] = await Promise.all([
      getResumenLocal(),
      pool.query(`
        SELECT
          COUNT(*)::int AS ordenes,
          COALESCE(SUM(
            (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
            + v.costo_delivery
          ), 0) AS total_usd
        FROM ventas v
        WHERE v.fecha = ${HOY} - INTERVAL '1 day'
          AND COALESCE(v.anulada, FALSE) = FALSE
          AND COALESCE(v.es_mesa_abierta, FALSE) = FALSE
      `).catch(() => ({ rows: [{ ordenes: 0, total_usd: 0 }] })),
    ]);

    // ventaHoy = ventas cobradas hoy (no CxC pendiente)
    const ordenes  = resumen.ventaHoy.cantidad;
    const totalUsd = resumen.ventaHoy.total_usd;
    // costo viene de resumen.hoy que tiene SUM de costo_unit * cantidad
    // No está en resumen directamente, calculamos utilidad como totalUsd - costoUsd
    // usando la misma lógica del hoy CTE (que sí incluye costos via venta_items)
    const ayer = ayerRes.rows[0];
    const ordenesAyer = Number(ayer.ordenes  ?? 0);
    const totalAyer   = Number(ayer.total_usd ?? 0);
    const ticket      = ordenes > 0 ? totalUsd / ordenes : 0;
    const ticketAyer  = ordenesAyer > 0 ? totalAyer / ordenesAyer : 0;

    // Utilidad: necesita costo, lo calculamos aquí para no alterar resumen.ts
    const costoRes = await pool.query(`
      SELECT COALESCE(SUM(vi.cantidad * vi.costo_unit), 0) AS costo_usd
      FROM ventas v
      JOIN venta_items vi ON vi.venta_id = v.id
      WHERE v.fecha = ${HOY}
        AND v.cuenta_por_cobrar = false
        AND COALESCE(v.anulada, FALSE) = FALSE
        AND COALESCE(v.es_mesa_abierta, FALSE) = FALSE
    `).catch(() => ({ rows: [{ costo_usd: 0 }] }));

    const costoUsd = Number(costoRes.rows[0]?.costo_usd ?? 0);
    const utilidad = totalUsd - costoUsd;

    return NextResponse.json({
      ordenes,
      totalUsd,
      ticket,
      utilidad,
      ayer: { ordenes: ordenesAyer, totalUsd: totalAyer, ticket: ticketAyer },
    });
  } catch (err) {
    console.error("metricas error:", err);
    return NextResponse.json({
      ordenes: 0, totalUsd: 0, ticket: 0, utilidad: 0,
      ayer: { ordenes: 0, totalUsd: 0, ticket: 0 },
    });
  }
}

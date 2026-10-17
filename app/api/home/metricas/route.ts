import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [ventasRes, ayerRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(DISTINCT v.id)::int                             AS ordenes,
          COALESCE(SUM(vi.precio_unit * vi.cantidad), 0)       AS total_usd,
          COALESCE(SUM(vi.costo_unit  * vi.cantidad), 0)       AS costo_usd
        FROM ventas v
        JOIN venta_items vi ON vi.venta_id = v.id
        WHERE v.fecha = (NOW() AT TIME ZONE 'America/Caracas')::date
          AND COALESCE(v.anulada, FALSE) = FALSE
          AND COALESCE(v.es_mesa_abierta, FALSE) = FALSE
      `),
      pool.query(`
        SELECT
          COUNT(DISTINCT v.id)::int                             AS ordenes,
          COALESCE(SUM(vi.precio_unit * vi.cantidad), 0)       AS total_usd
        FROM ventas v
        JOIN venta_items vi ON vi.venta_id = v.id
        WHERE v.fecha = (NOW() AT TIME ZONE 'America/Caracas')::date - INTERVAL '1 day'
          AND COALESCE(v.anulada, FALSE) = FALSE
          AND COALESCE(v.es_mesa_abierta, FALSE) = FALSE
      `).catch(() => ({ rows: [{ ordenes: 0, total_usd: 0 }] })),
    ]);

    const hoy = ventasRes.rows[0];
    const ayer = ayerRes.rows[0];

    const ordenes   = Number(hoy.ordenes   ?? 0);
    const totalUsd  = Number(hoy.total_usd ?? 0);
    const costoUsd  = Number(hoy.costo_usd ?? 0);
    const ticket    = ordenes > 0 ? totalUsd / ordenes : 0;
    const utilidad  = totalUsd - costoUsd;

    const ordenesAyer = Number(ayer.ordenes   ?? 0);
    const totalAyer   = Number(ayer.total_usd ?? 0);
    const ticketAyer  = ordenesAyer > 0 ? totalAyer / ordenesAyer : 0;

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

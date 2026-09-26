import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const [ventasRes, ayerRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                        AS ordenes,
          COALESCE(SUM(total_bs / NULLIF(tasa_dia, 0)), 0)   AS total_usd,
          COALESCE(SUM(costo_total_usd), 0)                   AS costo_usd
        FROM ventas
        WHERE DATE(created_at AT TIME ZONE 'America/Caracas')
                = (NOW() AT TIME ZONE 'America/Caracas')::date
          AND COALESCE(anulada, FALSE) = FALSE
      `).catch(() => pool.query(`
        SELECT COUNT(*)::int AS ordenes,
               0::numeric    AS total_usd,
               0::numeric    AS costo_usd
        FROM ventas
        WHERE DATE(created_at) = CURRENT_DATE
          AND COALESCE(anulada, FALSE) = FALSE
      `)),
      pool.query(`
        SELECT
          COUNT(*)::int                                        AS ordenes,
          COALESCE(SUM(total_bs / NULLIF(tasa_dia, 0)), 0)   AS total_usd
        FROM ventas
        WHERE DATE(created_at AT TIME ZONE 'America/Caracas')
                = (NOW() AT TIME ZONE 'America/Caracas')::date - INTERVAL '1 day'
          AND COALESCE(anulada, FALSE) = FALSE
      `).catch(() => ({ rows: [{ ordenes: 0, total_usd: 0 }] })),
    ]);

    const hoy = ventasRes.rows[0];
    const ayer = ayerRes.rows[0];

    const ordenes    = Number(hoy.ordenes    ?? 0);
    const totalUsd   = Number(hoy.total_usd  ?? 0);
    const costoUsd   = Number(hoy.costo_usd  ?? 0);
    const ticket     = ordenes > 0 ? totalUsd / ordenes : 0;
    const utilidad   = totalUsd - costoUsd;

    const ordenesAyer  = Number(ayer.ordenes   ?? 0);
    const totalAyer    = Number(ayer.total_usd ?? 0);
    const ticketAyer   = ordenesAyer > 0 ? totalAyer / ordenesAyer : 0;

    return NextResponse.json({
      ordenes,
      totalUsd,
      ticket,
      utilidad,
      ayer: { ordenes: ordenesAyer, totalUsd: totalAyer, ticket: ticketAyer },
    });
  } catch {
    return NextResponse.json({
      ordenes: 0, totalUsd: 0, ticket: 0, utilidad: 0,
      ayer: { ordenes: 0, totalUsd: 0, ticket: 0 },
    });
  }
}

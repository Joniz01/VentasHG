import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Endpoint público autenticado por API key para el dashboard consolidado.
// Devuelve indicadores clave de esta instancia.
export async function GET(request: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Dashboard no configurado" }, { status: 503 });
  }

  const provided = request.nextUrl.searchParams.get("apikey") ??
    request.headers.get("x-api-key");
  if (provided !== apiKey) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await pool.query(`
    WITH
    -- Ventas efectivas (excluye CxC pendientes; incluye CxC cobradas por fecha de cobro)
    hoy AS (
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(
          (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
          + v.costo_delivery
        ), 0) AS total_usd
      FROM ventas v
      WHERE
        (NOT v.cuenta_por_cobrar AND v.fecha = CURRENT_DATE)
        OR (v.cuenta_cobrada = true AND v.cuenta_cobrada_at::date = CURRENT_DATE)
    ),
    semana AS (
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(
          (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
          + v.costo_delivery
        ), 0) AS total_usd
      FROM ventas v
      WHERE
        (NOT v.cuenta_por_cobrar AND v.fecha >= date_trunc('week', CURRENT_DATE)::date)
        OR (v.cuenta_cobrada = true AND v.cuenta_cobrada_at::date >= date_trunc('week', CURRENT_DATE)::date)
    ),
    mes AS (
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(
          (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
          + v.costo_delivery
        ), 0) AS total_usd
      FROM ventas v
      WHERE
        (NOT v.cuenta_por_cobrar AND v.fecha >= date_trunc('month', CURRENT_DATE)::date)
        OR (v.cuenta_cobrada = true AND v.cuenta_cobrada_at::date >= date_trunc('month', CURRENT_DATE)::date)
    ),
    cxc AS (
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(
          (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
          + v.costo_delivery
        ), 0) AS total_usd
      FROM ventas v
      WHERE v.cuenta_por_cobrar = true AND v.cuenta_cobrada = false
    ),
    stock AS (
      SELECT
        COUNT(*)::int AS total_productos,
        COUNT(*) FILTER (WHERE stock_actual <= 0)::int AS sin_stock
      FROM productos
      WHERE activo = true AND tipo_producto = 'NORMAL'
    )
    SELECT
      (SELECT row_to_json(hoy) FROM hoy) AS hoy,
      (SELECT row_to_json(semana) FROM semana) AS semana,
      (SELECT row_to_json(mes) FROM mes) AS mes,
      (SELECT row_to_json(cxc) FROM cxc) AS cxc_pendiente,
      (SELECT row_to_json(stock) FROM stock) AS stock
  `);

  const row = result.rows[0];

  return NextResponse.json({
    empresa: process.env.EMPRESA_NOMBRE ?? "Empresa",
    hoy: row.hoy,
    semana: row.semana,
    mes: row.mes,
    cxcPendiente: row.cxc_pendiente,
    stock: row.stock,
  });
}

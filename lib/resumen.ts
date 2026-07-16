import { pool } from "@/lib/db";

export type ResumenData = {
  empresa: string;
  hoy: { cantidad: number; total_usd: number };
  semana: { cantidad: number; total_usd: number };
  mes: { cantidad: number; total_usd: number };
  cxcPendiente: { cantidad: number; total_usd: number };
  ventaHoy: { cantidad: number; total_usd: number };
  ingresos: { cantidad: number; total_usd: number };
  stock: { total_productos: number; sin_stock: number };
  error?: string;
};

export async function getResumenLocal(): Promise<ResumenData> {
  const result = await pool.query(`
    WITH
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
    venta_hoy AS (
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(
          (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
          + v.costo_delivery
        ), 0) AS total_usd
      FROM ventas v
      WHERE v.fecha = CURRENT_DATE AND v.cuenta_por_cobrar = false
    ),
    ingresos AS (
      SELECT
        COUNT(*)::int AS cantidad,
        COALESCE(SUM(
          (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id)
          + v.costo_delivery
        ), 0) AS total_usd
      FROM ventas v
      WHERE v.cuenta_cobrada = true
        AND v.cuenta_cobrada_at::date = CURRENT_DATE
        AND v.fecha < CURRENT_DATE
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
      (SELECT row_to_json(venta_hoy) FROM venta_hoy) AS venta_hoy,
      (SELECT row_to_json(ingresos) FROM ingresos) AS ingresos,
      (SELECT row_to_json(stock) FROM stock) AS stock
  `);

  const row = result.rows[0];
  return {
    empresa: process.env.EMPRESA_NOMBRE ?? "Empresa",
    hoy: row.hoy,
    semana: row.semana,
    mes: row.mes,
    cxcPendiente: row.cxc_pendiente,
    ventaHoy: row.venta_hoy,
    ingresos: row.ingresos,
    stock: row.stock,
  };
}

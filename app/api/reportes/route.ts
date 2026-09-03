import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { METODOS_PAGO, METODOS_PAGO_USD, type MetodoPago } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta) {
    return NextResponse.json(
      { error: "Debes indicar el rango de fechas (desde y hasta)" },
      { status: 400 }
    );
  }

  try {

  const includePendientes = searchParams.get("pendientes") === "1";

  // Filtro base: ventas cobradas al contado + cuentas cobradas por fecha de cobro.
  // Para CxC usa pagos_venta.fecha_pago como fuente principal (igual que forma-de-pago),
  // con fallback a cuenta_cobrada_at para registros anteriores sin fila en pagos_venta.
  const cxcFiltro = `(v.cuenta_cobrada = true AND (
    EXISTS (
      SELECT 1 FROM pagos_venta pv
      WHERE pv.venta_id = v.id AND pv.fecha_pago BETWEEN $1 AND $2
    )
    OR (
      NOT EXISTS (SELECT 1 FROM pagos_venta pv WHERE pv.venta_id = v.id)
      AND v.cuenta_cobrada_at::date BETWEEN $1 AND $2
    )
  ))`;
  const filtroBase = includePendientes
    ? `(NOT v.cuenta_por_cobrar AND v.fecha BETWEEN $1 AND $2)
       OR ${cxcFiltro}
       OR (v.cuenta_por_cobrar = true AND v.cuenta_cobrada = false AND v.fecha BETWEEN $1 AND $2)`
    : `(NOT v.cuenta_por_cobrar AND v.fecha BETWEEN $1 AND $2)
       OR ${cxcFiltro}`;

  // Solo cuentas efectivamente cobradas en el periodo:
  // - ventas normales (no CxC) por su fecha de venta
  // - cuentas por cobrar ya cobradas por la fecha en que se marcaron como cobradas
  const resumenResult = await pool.query(
    `SELECT v.id, v.costo_delivery, v.tasa_dia,
            COALESCE(
              (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id),
              0
            ) AS total_items
     FROM ventas v
     WHERE ${filtroBase}`,
    [desde, hasta]
  );

  let totalVentasUsd = 0;
  let totalVentasBs = 0;
  for (const row of resumenResult.rows) {
    const usd = Number(row.total_items) + Number(row.costo_delivery);
    totalVentasUsd += usd;
    totalVentasBs += usd * Number(row.tasa_dia);
  }

  const pagosResult = await pool.query(
    `SELECT pv.metodo, pv.monto, v.tasa_dia
     FROM pagos_venta pv
     JOIN ventas v ON v.id = pv.venta_id
     WHERE COALESCE(pv.fecha_pago, v.fecha) BETWEEN $1 AND $2`,
    [desde, hasta]
  );

  const porFormaPagoMap = new Map<MetodoPago, { totalUsd: number; totalBs: number }>();
  for (const metodo of METODOS_PAGO) {
    porFormaPagoMap.set(metodo, { totalUsd: 0, totalBs: 0 });
  }

  for (const row of pagosResult.rows) {
    const metodo = row.metodo as MetodoPago;
    const monto = Number(row.monto);
    const tasa = Number(row.tasa_dia);
    const acc = porFormaPagoMap.get(metodo);
    if (!acc) continue;

    if (METODOS_PAGO_USD.includes(metodo)) {
      acc.totalUsd += monto;
      acc.totalBs += monto * tasa;
    } else {
      acc.totalBs += monto;
      acc.totalUsd += tasa > 0 ? monto / tasa : 0;
    }
  }

  const porFormaPago = METODOS_PAGO.map((metodo) => ({
    metodo,
    ...(porFormaPagoMap.get(metodo) ?? { totalUsd: 0, totalBs: 0 }),
  }));

  const porClienteResult = await pool.query(
    `WITH venta_totales AS (
       SELECT v.id, v.cliente, v.cliente_ci, v.costo_delivery, v.tasa_dia,
              v.cuenta_por_cobrar, v.cuenta_cobrada,
              COALESCE(
                (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id),
                0
              ) AS total_items
       FROM ventas v
       WHERE ${filtroBase}
     ),
     pagos_por_venta AS (
       SELECT pv.venta_id,
              SUM(
                CASE WHEN pv.metodo IN ('EFECTIVO_USD','ZELLE','CASHEA','YUMMY','CXC_DIRECTA')
                     THEN pv.monto
                     ELSE pv.monto / NULLIF(vt.tasa_dia, 0)
                END
              ) AS cobrado_usd,
              SUM(
                CASE WHEN pv.metodo IN ('EFECTIVO_USD','ZELLE','CASHEA','YUMMY','CXC_DIRECTA')
                     THEN pv.monto * vt.tasa_dia
                     ELSE pv.monto
                END
              ) AS cobrado_bs
       FROM pagos_venta pv
       JOIN venta_totales vt ON vt.id = pv.venta_id
       GROUP BY pv.venta_id
     )
     SELECT vt.cliente, vt.cliente_ci,
            COUNT(*) AS cantidad_ventas,
            SUM(vt.total_items + COALESCE(vt.costo_delivery, 0)) AS total_usd,
            COALESCE(SUM(ppv.cobrado_usd), 0) AS cobrado_usd,
            COALESCE(SUM(ppv.cobrado_bs), 0) AS cobrado_bs,
            GREATEST(
              SUM(vt.total_items + COALESCE(vt.costo_delivery, 0))
              - COALESCE(SUM(ppv.cobrado_usd), 0),
              0
            ) AS pendiente_usd
     FROM venta_totales vt
     LEFT JOIN pagos_por_venta ppv ON ppv.venta_id = vt.id
     GROUP BY vt.cliente, vt.cliente_ci
     ORDER BY total_usd DESC`,
    [desde, hasta]
  );

  const porCliente = porClienteResult.rows.map((row) => ({
    cliente: row.cliente,
    clienteCi: row.cliente_ci,
    cantidadVentas: Number(row.cantidad_ventas),
    totalUsd: Number(row.total_usd),
    cobradoUsd: Number(row.cobrado_usd),
    cobradoBs: Number(row.cobrado_bs),
    pendienteUsd: Number(row.pendiente_usd),
  }));

  const porProductoResult = await pool.query(
    `SELECT p.id AS producto_id, p.nombre,
            SUM(vi.cantidad) AS cantidad,
            SUM(vi.cantidad * vi.precio_unit) AS total_usd,
            SUM(vi.cantidad * (vi.precio_unit - vi.costo_unit)) AS margen_usd
     FROM venta_items vi
     JOIN ventas v ON v.id = vi.venta_id
     JOIN productos p ON p.id = vi.producto_id
     WHERE ${filtroBase}
     GROUP BY p.id, p.nombre
     ORDER BY total_usd DESC`,
    [desde, hasta]
  );

  const porProducto = porProductoResult.rows.map((row) => ({
    productoId: row.producto_id,
    nombre: row.nombre,
    cantidad: Number(row.cantidad),
    totalUsd: Number(row.total_usd),
    margenUsd: Number(row.margen_usd),
  }));

  // Detalle de ventas por forma de pago (para conciliación)
  const detalleResult = await pool.query(
    `SELECT pv.metodo, pv.monto, v.id, v.cliente, v.tasa_dia,
            COALESCE(
              (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id),
              0
            ) + v.costo_delivery AS total_venta_usd
     FROM pagos_venta pv
     JOIN ventas v ON v.id = pv.venta_id
     WHERE COALESCE(pv.fecha_pago, v.fecha) BETWEEN $1 AND $2
     ORDER BY pv.metodo, v.id DESC`,
    [desde, hasta]
  );

  const ventasPorFormaPago: Record<string, { ventaId: number; cliente: string; montoUsd: number; montoBs: number }[]> = {};
  for (const row of detalleResult.rows) {
    const metodo = row.metodo as string;
    const monto = Number(row.monto);
    const tasa = Number(row.tasa_dia);
    const esPagoUsd = (METODOS_PAGO_USD as readonly string[]).includes(metodo);
    const montoUsd = esPagoUsd ? monto : (tasa > 0 ? monto / tasa : 0);
    const montoBs = esPagoUsd ? monto * tasa : monto;
    if (!ventasPorFormaPago[metodo]) ventasPorFormaPago[metodo] = [];
    ventasPorFormaPago[metodo].push({
      ventaId: row.id,
      cliente: row.cliente,
      montoUsd,
      montoBs,
    });
  }

    return NextResponse.json({
      desde,
      hasta,
      totalVentasUsd,
      totalVentasBs,
      cantidadVentas: resumenResult.rowCount ?? 0,
      porFormaPago,
      porCliente,
      porProducto,
      ventasPorFormaPago,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al generar el reporte";
    console.error("[GET /api/reportes]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

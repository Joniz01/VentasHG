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

  const includePendientes = searchParams.get("pendientes") === "1";

  // Filtro base: ventas cobradas al contado + cuentas cobradas por fecha de cobro.
  // Si includePendientes, también incluye cuentas pendientes (por fecha de venta).
  const filtroBase = includePendientes
    ? `(NOT v.cuenta_por_cobrar AND v.fecha BETWEEN $1 AND $2)
       OR (v.cuenta_cobrada = true AND v.cuenta_cobrada_at::date BETWEEN $1 AND $2)
       OR (v.cuenta_por_cobrar = true AND v.cuenta_cobrada = false AND v.fecha BETWEEN $1 AND $2)`
    : `(NOT v.cuenta_por_cobrar AND v.fecha BETWEEN $1 AND $2)
       OR (v.cuenta_cobrada = true AND v.cuenta_cobrada_at::date BETWEEN $1 AND $2)`;

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
       SELECT v.id, v.cliente, v.cliente_ci, v.costo_delivery,
              COALESCE(
                (SELECT SUM(vi.cantidad * vi.precio_unit) FROM venta_items vi WHERE vi.venta_id = v.id),
                0
              ) AS total_items
       FROM ventas v
       WHERE ${filtroBase}
     )
     SELECT cliente, cliente_ci,
            COUNT(*) AS cantidad_ventas,
            SUM(total_items + costo_delivery) AS total_usd
     FROM venta_totales
     GROUP BY cliente, cliente_ci
     ORDER BY total_usd DESC`,
    [desde, hasta]
  );

  const porCliente = porClienteResult.rows.map((row) => ({
    cliente: row.cliente,
    clienteCi: row.cliente_ci,
    cantidadVentas: Number(row.cantidad_ventas),
    totalUsd: Number(row.total_usd),
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
}

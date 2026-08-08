import { notFound } from "next/navigation";
import { getReporte } from "@/lib/getReporte";
import { METODO_PAGO_LABELS } from "@/lib/types";
import { pool } from "@/lib/db";
import { getResumenLocal } from "@/lib/resumen";
import ImagenPuntoToggle from "./ImagenPuntoToggle";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

export default async function ReporteVistaPage({ searchParams }: Props) {
  const { desde, hasta } = await searchParams;

  if (!desde || !hasta) notFound();

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
  const esHoy = desde === hasta && desde === hoy;

  const [reporte, imagenResult, resumen] = await Promise.all([
    getReporte(desde, hasta),
    pool.query(`SELECT data FROM reporte_imagenes WHERE desde = $1 AND hasta = $2`, [desde, hasta]),
    esHoy ? getResumenLocal().catch(() => null) : Promise.resolve(null),
  ]);

  const imagenData: string | null = imagenResult.rows[0]?.data ?? null;

  const empresa = process.env.EMPRESA_NOMBRE ?? "VentasHG";
  const periodo = desde === hasta ? desde : `${desde} al ${hasta}`;
  const formaPagoConMonto = reporte.porFormaPago.filter((fp) => fp.totalUsd > 0 || fp.totalBs > 0);

  const ventaHoy = resumen?.ventaHoy?.total_usd ?? null;
  const ingresos = resumen?.ingresos?.total_usd ?? null;

  return (
    <div className="min-h-screen bg-zinc-50 flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{empresa}</p>
        <p className="mt-0.5 text-sm text-zinc-500">Reporte de Ventas — {periodo}</p>

        {esHoy && ventaHoy !== null && ingresos !== null ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="text-sm font-medium text-zinc-500">Venta Hoy</span>
              <span className="text-sm font-semibold text-zinc-800">${ventaHoy.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <span className="text-sm font-medium text-zinc-500">Ingresos</span>
              <span className="text-sm font-semibold text-zinc-800">${ingresos.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <span className="text-sm font-semibold text-green-700">Total Ingreso Hoy</span>
              <span className="text-sm font-bold text-green-700">${(ventaHoy + ingresos).toFixed(2)}</span>
            </div>
            <p className="text-xs text-zinc-400">
              {reporte.cantidadVentas} {reporte.cantidadVentas === 1 ? "venta" : "ventas"} registradas
            </p>
          </div>
        ) : (
          <>
            <p className="mt-3 text-3xl font-bold text-zinc-900">
              ${reporte.totalVentasUsd.toFixed(2)}
            </p>
            <p className="text-sm font-medium text-zinc-600">
              Bs {reporte.totalVentasBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-zinc-500">
              {reporte.cantidadVentas} {reporte.cantidadVentas === 1 ? "venta" : "ventas"}
            </p>
          </>
        )}

        {formaPagoConMonto.length > 0 && (
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Por forma de pago</p>
            <div className="flex flex-col gap-2">
              {formaPagoConMonto.map((fp) => (
                <div key={fp.metodo} className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-zinc-700">{METODO_PAGO_LABELS[fp.metodo]}</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-zinc-900">${fp.totalUsd.toFixed(2)}</span>
                    <span className="ml-1.5 text-xs text-zinc-400">Bs {fp.totalBs.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-2 border-t border-zinc-100 pt-2">
                <span className="text-sm font-semibold text-zinc-900">Total</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-zinc-900">
                    ${reporte.porFormaPago.reduce((a, fp) => a + fp.totalUsd, 0).toFixed(2)}
                  </span>
                  <span className="ml-1.5 text-xs text-zinc-400">
                    Bs {reporte.porFormaPago.reduce((a, fp) => a + fp.totalBs, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {imagenData && <ImagenPuntoToggle imagen={imagenData} />}
      </div>
    </div>
  );
}

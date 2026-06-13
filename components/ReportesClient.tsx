"use client";

import { FormEvent, useState } from "react";
import type { ReporteVentas } from "@/lib/types";
import { METODO_PAGO_LABELS } from "@/lib/types";
import DeliveryPagosPanel from "@/components/DeliveryPagosPanel";
import CuentasPorCobrarPanel from "@/components/CuentasPorCobrarPanel";

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function ReportesClient() {
  const [tab, setTab] = useState<"ventas" | "deliveries" | "cuentasPorCobrar">("ventas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mesEspecifico, setMesEspecifico] = useState("");
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar(desdeParam: string, hastaParam: string) {
    setError(null);
    setLoading(true);
    setDesde(desdeParam);
    setHasta(hastaParam);
    try {
      const res = await fetch(
        `/api/reportes?desde=${desdeParam}&hasta=${hastaParam}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al generar el reporte");
      }
      setReporte(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el reporte");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  function handleHoy() {
    setMesEspecifico("");
    const hoy = toIsoDate(new Date());
    generar(hoy, hoy);
  }

  function handleSemana() {
    setMesEspecifico("");
    const hoy = new Date();
    generar(toIsoDate(startOfWeek(hoy)), toIsoDate(hoy));
  }

  function handleMes() {
    setMesEspecifico("");
    const hoy = new Date();
    generar(toIsoDate(startOfMonth(hoy)), toIsoDate(hoy));
  }

  function handleMesEspecifico(value: string) {
    setMesEspecifico(value);
    if (!value) return;

    const [year, month] = value.split("-").map(Number);
    const inicio = new Date(year, month - 1, 1);
    const fin = new Date(year, month, 0);
    generar(toIsoDate(inicio), toIsoDate(fin));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!desde || !hasta) {
      setError("Selecciona el rango de fechas");
      return;
    }
    setMesEspecifico("");
    generar(desde, hasta);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setTab("ventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "ventas"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Ventas
        </button>
        <button
          type="button"
          onClick={() => setTab("deliveries")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "deliveries"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Pagos a Delivery
        </button>
        <button
          type="button"
          onClick={() => setTab("cuentasPorCobrar")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "cuentasPorCobrar"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Ventas por Cobrar
        </button>
      </div>

      {tab === "deliveries" && <DeliveryPagosPanel />}

      {tab === "cuentasPorCobrar" && <CuentasPorCobrarPanel />}

      {tab === "ventas" && (
      <>
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={handleHoy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleSemana}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={handleMes}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Este mes
          </button>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">Mes específico</label>
            <input
              type="month"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              value={mesEspecifico}
              onChange={(e) => handleMesEspecifico(e.target.value)}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Desde</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Hasta</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Generar reporte
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-zinc-500">Generando reporte...</div>}

      {reporte && !loading && (
        <>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-600">
              Periodo: {reporte.desde} a {reporte.hasta}
            </p>
            <p className="mt-1 text-lg font-semibold">
              Total de ventas: ${reporte.totalVentasUsd.toFixed(2)} ({reporte.cantidadVentas}{" "}
              {reporte.cantidadVentas === 1 ? "venta" : "ventas"})
            </p>
          </div>

          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por forma de pago
            </h3>
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Forma de pago</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total $</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total Bs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porFormaPago.map((fp) => (
                  <tr key={fp.metodo}>
                    <td className="px-4 py-2 font-medium">{METODO_PAGO_LABELS[fp.metodo]}</td>
                    <td className="px-4 py-2 text-right">${fp.totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">Bs {fp.totalBs.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-zinc-200 bg-zinc-50">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    ${reporte.porFormaPago.reduce((acc, fp) => acc + fp.totalUsd, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    Bs {reporte.porFormaPago.reduce((acc, fp) => acc + fp.totalBs, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por cliente
            </h3>
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cédula</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Ventas</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porCliente.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      No hay ventas en el periodo seleccionado
                    </td>
                  </tr>
                )}
                {reporte.porCliente.map((c) => (
                  <tr key={`${c.cliente}-${c.clienteCi ?? ""}`}>
                    <td className="px-4 py-2 font-medium">{c.cliente}</td>
                    <td className="px-4 py-2 text-zinc-600">{c.clienteCi ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{c.cantidadVentas}</td>
                    <td className="px-4 py-2 text-right">${c.totalUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por producto
            </h3>
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Producto</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Cantidad</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total $</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Margen $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porProducto.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      No hay ventas en el periodo seleccionado
                    </td>
                  </tr>
                )}
                {reporte.porProducto.map((p) => (
                  <tr key={p.productoId}>
                    <td className="px-4 py-2 font-medium">{p.nombre}</td>
                    <td className="px-4 py-2 text-right">{p.cantidad}</td>
                    <td className="px-4 py-2 text-right">${p.totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">${p.margenUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      </>
      )}
    </div>
  );
}

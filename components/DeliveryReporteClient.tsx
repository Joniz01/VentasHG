"use client";

import { FormEvent, useState } from "react";
import type { ReporteDeliveryMotorizado } from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";

const MAX_DIAS_ATRAS = 21;

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

function minDesde() {
  const d = new Date();
  d.setDate(d.getDate() - MAX_DIAS_ATRAS);
  return toIsoDate(d);
}

export default function DeliveryReporteClient() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [reporte, setReporte] = useState<ReporteDeliveryMotorizado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar(desdeParam: string, hastaParam: string) {
    setError(null);
    setLoading(true);
    setDesde(desdeParam);
    setHasta(hastaParam);
    try {
      const res = await fetch(`/api/delivery-reporte?desde=${desdeParam}&hasta=${hastaParam}`);
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
    const hoy = toIsoDate(new Date());
    generar(hoy, hoy);
  }

  function handleSemana() {
    const hoy = new Date();
    generar(toIsoDate(startOfWeek(hoy)), toIsoDate(hoy));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!desde || !hasta) {
      setError("Selecciona el rango de fechas");
      return;
    }
    generar(desde, hasta);
  }

  return (
    <div className="flex flex-col gap-4">
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
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Desde</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={desde}
              min={minDesde()}
              max={toIsoDate(new Date())}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Hasta</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={hasta}
              min={minDesde()}
              max={toIsoDate(new Date())}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Generando..." : "Generar"}
          </button>
        </form>
        <p className="text-xs text-zinc-500">El rango máximo permitido es de 3 semanas atrás.</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {reporte && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <span className="font-medium text-zinc-600">Total deliveries: </span>
            {reporte.totalBs.toFixed(2)} Bs{" "}
            <span className="text-zinc-500">(${reporte.totalUsd.toFixed(2)})</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Pedido #</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto delivery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      No hay deliveries en el período seleccionado
                    </td>
                  </tr>
                )}
                {reporte.items.map((item) => (
                  <tr key={item.ventaId}>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">#{item.ventaId}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {formatFecha(item.fecha)}
                    </td>
                    <td className="px-4 py-2 font-medium whitespace-nowrap">{item.cliente}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {item.costoDeliveryBs.toFixed(2)} Bs{" "}
                      <span className="text-zinc-500">(${item.costoDeliveryUsd.toFixed(2)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

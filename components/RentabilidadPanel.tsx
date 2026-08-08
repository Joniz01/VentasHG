"use client";

import { useState, useCallback } from "react";

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function fmt(n: number) {
  return n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number) {
  return n.toFixed(1) + "%";
}

type SalidaTipo = {
  tipo: string;
  label: string;
  cantidad: number;
  costoTotal: number;
};

type DetalleItem = {
  producto: string;
  tipo: string;
  cantidadTotal: number;
  costoTotal: number;
};

type RentabilidadData = {
  desde: string;
  hasta: string;
  cantidadVentas: number;
  ingresosUsd: number;
  costoVentas: number;
  margenBruto: number;
  margenBrutoPct: number;
  salidas: SalidaTipo[];
  costoSalidasTotal: number;
  costoSalidasPct: number;
  rentabilidadOperativa: number;
  rentabilidadOperativaPct: number;
  detalle: DetalleItem[];
};

export default function RentabilidadPanel() {
  const today = toIsoDate(new Date());
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);
  const [data, setData] = useState<RentabilidadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (d: string, h: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/rentabilidad?desde=${d}&hasta=${h}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleHoy() {
    const d = toIsoDate(new Date());
    setDesde(d); setHasta(d);
    cargar(d, d);
  }

  function handleSemana() {
    const now = new Date();
    const d = toIsoDate(startOfWeek(now));
    const h = toIsoDate(now);
    setDesde(d); setHasta(h);
    cargar(d, h);
  }

  function handleMes() {
    const now = new Date();
    const d = toIsoDate(startOfMonth(now));
    const h = toIsoDate(now);
    setDesde(d); setHasta(h);
    cargar(d, h);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!desde || !hasta) return;
    cargar(desde, hasta);
  }

  const kpiClass = (val: number, good: boolean) => {
    if (val >= 50 && good) return "text-emerald-600";
    if (val >= 30 && good) return "text-amber-500";
    if (good) return "text-red-500";
    if (val <= 5) return "text-emerald-600";
    if (val <= 15) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <button type="button" onClick={handleHoy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100">
            Hoy
          </button>
          <button type="button" onClick={handleSemana}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100">
            Esta semana
          </button>
          <button type="button" onClick={handleMes}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100">
            Este mes
          </button>
          <div className="flex items-center gap-1 ml-2">
            <label className="text-xs text-zinc-500">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-zinc-500">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </div>
          <button type="submit"
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            disabled={loading}>
            {loading ? "Calculando…" : "Calcular"}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Ventas cobradas</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{data.cantidadVentas}</p>
              <p className="text-sm text-zinc-500">Ingresos: <span className="font-medium text-zinc-800">${fmt(data.ingresosUsd)}</span></p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Margen bruto</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpiClass(data.margenBrutoPct, true)}`}>
                {pct(data.margenBrutoPct)}
              </p>
              <p className="text-sm text-zinc-500">${fmt(data.margenBruto)} de ${fmt(data.ingresosUsd)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Rentabilidad operativa</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${kpiClass(data.rentabilidadOperativaPct, true)}`}>
                {pct(data.rentabilidadOperativaPct)}
              </p>
              <p className="text-sm text-zinc-500">${fmt(data.rentabilidadOperativa)}</p>
            </div>
          </div>

          {/* Estado de costos */}
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="border-b border-zinc-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-800">Estado de costos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-4 py-2 text-left font-medium text-zinc-500">Concepto</th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500">USD</th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-500">% Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-100 font-medium bg-zinc-50">
                    <td className="px-4 py-2.5 text-zinc-800">Ingresos totales</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-800">${fmt(data.ingresosUsd)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">100.0%</td>
                  </tr>
                  <tr className="border-b border-zinc-100">
                    <td className="px-4 py-2.5 pl-8 text-zinc-600">− Costo de ventas</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-600">−${fmt(data.costoVentas)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">
                      {data.ingresosUsd > 0 ? pct((data.costoVentas / data.ingresosUsd) * 100) : "—"}
                    </td>
                  </tr>
                  <tr className="border-b border-zinc-200 font-medium">
                    <td className="px-4 py-2.5 text-zinc-800">= Margen bruto</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${kpiClass(data.margenBrutoPct, true)}`}>
                      ${fmt(data.margenBruto)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${kpiClass(data.margenBrutoPct, true)}`}>
                      {pct(data.margenBrutoPct)}
                    </td>
                  </tr>

                  {data.salidas.length > 0 && (
                    <tr className="border-b border-zinc-100">
                      <td colSpan={3} className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400 bg-zinc-50">
                        Salidas no comerciales
                      </td>
                    </tr>
                  )}

                  {data.salidas.map((s) => (
                    <tr key={s.tipo} className="border-b border-zinc-100">
                      <td className="px-4 py-2 pl-8 text-zinc-600">
                        − {s.label}
                        <span className="ml-2 text-xs text-zinc-400">({s.cantidad} salida{s.cantidad !== 1 ? "s" : ""})</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600">−${fmt(s.costoTotal)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                        {data.ingresosUsd > 0 ? pct((s.costoTotal / data.ingresosUsd) * 100) : "—"}
                      </td>
                    </tr>
                  ))}

                  {data.salidas.length === 0 && (
                    <tr className="border-b border-zinc-100">
                      <td colSpan={3} className="px-4 py-2 pl-8 text-sm text-zinc-400 italic">Sin salidas no comerciales en el período</td>
                    </tr>
                  )}

                  <tr className="border-b border-zinc-100">
                    <td className="px-4 py-2.5 pl-8 text-zinc-600 font-medium">Subtotal salidas no comerciales</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-600 font-medium">−${fmt(data.costoSalidasTotal)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{pct(data.costoSalidasPct)}</td>
                  </tr>

                  <tr className="font-semibold bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-900">= Rentabilidad operativa</td>
                    <td className={`px-4 py-3 text-right tabular-nums text-lg ${kpiClass(data.rentabilidadOperativaPct, true)}`}>
                      ${fmt(data.rentabilidadOperativa)}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${kpiClass(data.rentabilidadOperativaPct, true)}`}>
                      {pct(data.rentabilidadOperativaPct)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalle por producto */}
          {data.detalle.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-800">Detalle por producto — salidas no comerciales</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Top 20 por costo</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="px-4 py-2 text-left font-medium text-zinc-500">Producto</th>
                      <th className="px-4 py-2 text-left font-medium text-zinc-500">Tipo</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Cantidad</th>
                      <th className="px-4 py-2 text-right font-medium text-zinc-500">Costo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.detalle.map((d, i) => (
                      <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50">
                        <td className="px-4 py-2 text-zinc-800">{d.producto}</td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{d.tipo}</span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-600">{d.cantidadTotal}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-zinc-800 font-medium">${fmt(d.costoTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400">
          Selecciona un período y presiona Calcular para ver el análisis de rentabilidad
        </div>
      )}
    </div>
  );
}

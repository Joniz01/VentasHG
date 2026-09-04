"use client";

import { useEffect, useState } from "react";
import { METODOS_PAGO, METODO_PAGO_LABELS } from "@/lib/types";
import type { ReporteVentas, ReporteDetalleVenta } from "@/lib/types";

function isoHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoAyer() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ConciliacionPanel() {
  const [periodo, setPeriodo] = useState<"hoy" | "ayer" | "custom">("hoy");
  const [fechaCustom, setFechaCustom] = useState("");
  const [metodo, setMetodo] = useState("");
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fechaEfectiva = periodo === "hoy" ? isoHoy() : periodo === "ayer" ? isoAyer() : fechaCustom;

  useEffect(() => {
    if (!fechaEfectiva) return;
    setLoading(true);
    setError(null);
    fetch(`/api/reportes?desde=${fechaEfectiva}&hasta=${fechaEfectiva}`)
      .then((r) => r.json())
      .then((data) => { setReporte(data); setMetodo(""); })
      .catch(() => setError("No se pudo cargar la conciliación"))
      .finally(() => setLoading(false));
  }, [fechaEfectiva]);

  const metodosConVentas = reporte
    ? METODOS_PAGO.filter((m) => (reporte.ventasPorFormaPago?.[m]?.length ?? 0) > 0)
    : [];

  const ventas: ReporteDetalleVenta[] = reporte
    ? (metodo ? (reporte.ventasPorFormaPago?.[metodo] ?? []) : metodosConVentas.flatMap((m) => reporte.ventasPorFormaPago?.[m] ?? []))
    : [];

  const totalUsd = ventas.reduce((s, v) => s + v.montoUsd, 0);
  const totalBs = ventas.reduce((s, v) => s + v.montoBs, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de fecha */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["hoy", "ayer"] as const).map((p) => (
          <button key={p} type="button" onClick={() => setPeriodo(p)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid",
              background: periodo === p ? "var(--erp-primary)" : "var(--erp-surface)",
              borderColor: periodo === p ? "var(--erp-primary)" : "var(--erp-border)",
              color: periodo === p ? "#fff" : "var(--erp-text)",
            }}>
            {p === "hoy" ? "Hoy" : "Ayer"}
          </button>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" onClick={() => setPeriodo("custom")}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid",
              background: periodo === "custom" ? "var(--erp-primary)" : "var(--erp-surface)",
              borderColor: periodo === "custom" ? "var(--erp-primary)" : "var(--erp-border)",
              color: periodo === "custom" ? "#fff" : "var(--erp-text)",
            }}>
            📅 Día específico
          </button>
          {periodo === "custom" && (
            <input type="date" value={fechaCustom} onChange={(e) => setFechaCustom(e.target.value)}
              style={{ border: "1px solid var(--erp-border)", borderRadius: 8, padding: "5px 10px", fontSize: 13 }} />
          )}
        </div>
        {loading && <span style={{ fontSize: 12, color: "var(--erp-text-3)" }}>Cargando...</span>}
        {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
      </div>

      {/* Selector de forma de pago */}
      {reporte && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMetodo("")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              !metodo ? "border-zinc-800 bg-zinc-800 text-white" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
            }`}>
            Todos
          </button>
          {metodosConVentas.map((m) => (
            <button key={m} type="button" onClick={() => setMetodo(metodo === m ? "" : m)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                metodo === m ? "border-zinc-800 bg-zinc-800 text-white" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
              }`}>
              {METODO_PAGO_LABELS[m as keyof typeof METODO_PAGO_LABELS]} ({reporte.ventasPorFormaPago?.[m]?.length ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* Tabla */}
      {!reporte && !loading && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-8 text-center text-sm text-zinc-500">
          {periodo === "custom" && !fechaCustom ? "Selecciona una fecha para ver la conciliación." : "Sin ventas registradas para este día."}
        </div>
      )}
      {reporte && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-base font-semibold">
              {metodo ? METODO_PAGO_LABELS[metodo as keyof typeof METODO_PAGO_LABELS] : "Todas las formas de pago"}
              <span className="ml-2 text-sm font-normal text-zinc-500">{ventas.length} {ventas.length === 1 ? "venta" : "ventas"}</span>
            </h3>
          </div>
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Pedido</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto $</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto Bs</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {ventas.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">Sin ventas en este período</td></tr>
              ) : (
                ventas.map((v) => (
                  <tr key={`${metodo}-${v.ventaId}`} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 font-medium text-zinc-700">#{v.ventaId}</td>
                    <td className="px-4 py-2 text-zinc-700">{v.cliente}</td>
                    <td className="px-4 py-2 text-right tabular-nums">${v.montoUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-zinc-500 tabular-nums">Bs {v.montoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2 text-right">
                      <a href={`/ventas/${v.ventaId}`} target="_blank" rel="noreferrer"
                        className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
                        Ver →
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <tr>
                <td colSpan={2} className="px-4 py-2 font-semibold">Total</td>
                <td className="px-4 py-2 text-right font-semibold">${totalUsd.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-semibold">Bs {totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

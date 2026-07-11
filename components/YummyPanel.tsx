"use client";

import { useEffect, useState } from "react";
import type { YummyPagoItem } from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";

type EstadoFiltro = "PENDIENTE" | "LIQUIDADO" | "TODOS";

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function esVencida(item: YummyPagoItem): boolean {
  return !item.liquidado && item.fechaVencimiento <= toIsoDate(new Date());
}

export default function YummyPanel() {
  const [items, setItems] = useState<YummyPagoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoFiltro>("PENDIENTE");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function loadItems(filtro: EstadoFiltro) {
    setLoading(true);
    setError(null);
    try {
      const param = filtro === "TODOS" ? "" : `?estado=${filtro}`;
      const res = await fetch(`/api/reportes/yummy${param}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar pagos Yummy");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems(estado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  async function handleToggleLiquidado(item: YummyPagoItem) {
    setUpdatingId(item.ventaId);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/yummy/${item.ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidado: !item.liquidado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al actualizar");
      setItems((prev) =>
        prev.map((it) =>
          it.ventaId === item.ventaId
            ? { ...it, liquidado: data.liquidado, liquidadoAt: data.liquidadoAt }
            : it
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setUpdatingId(null);
    }
  }

  const pendientes = items.filter((i) => !i.liquidado);
  const totalPendiente = pendientes.reduce((acc, i) => acc + i.monto, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Logo / branding */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00c853] text-white font-extrabold text-sm select-none">Y</div>
        <span className="font-bold text-lg" style={{ color: "#00c853" }}>Yummy</span>
        <span className="text-sm text-zinc-500">— Cuentas por Cobrar</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["PENDIENTE", "LIQUIDADO", "TODOS"] as EstadoFiltro[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstado(e)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              estado === e
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            {e === "PENDIENTE" ? "Pendientes" : e === "LIQUIDADO" ? "Liquidados" : "Todos"}
          </button>
        ))}
      </div>

      {estado !== "LIQUIDADO" && (
        <div className="rounded-lg border border-[#00c853]/40 bg-[#e8f5e9] p-4 text-sm w-fit">
          <span className="font-medium text-zinc-700">Por cobrar a Yummy: </span>
          <span className="font-semibold text-[#007e33]">${totalPendiente.toFixed(2)}</span>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pedido #</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Fecha venta</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Días</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Vence</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Estado</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">Cargando...</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  No hay pagos Yummy
                </td>
              </tr>
            )}
            {!loading && items.map((item) => {
              const vencida = esVencida(item);
              return (
                <tr key={item.ventaId} className={vencida ? "bg-red-50" : ""}>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">#{item.ventaId}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatFecha(item.fecha)}</td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">{item.cliente}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap font-semibold text-[#007e33]">
                    ${item.monto.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">{item.dias}d</td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    <span className={vencida ? "font-semibold text-red-700" : ""}>
                      {formatFecha(item.fechaVencimiento)}
                    </span>
                    {vencida && (
                      <span className="ml-1 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                        Vencido
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {item.liquidado ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Cobrado
                      </span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#e8f5e9", color: "#007e33" }}>
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {item.liquidado ? (
                      <button
                        onClick={() => handleToggleLiquidado(item)}
                        disabled={updatingId === item.ventaId}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                      >
                        Marcar pendiente
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleLiquidado(item)}
                        disabled={updatingId === item.ventaId}
                        className="rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50"
                        style={{ borderColor: "#00c853", backgroundColor: "#e8f5e9", color: "#007e33" }}
                      >
                        {updatingId === item.ventaId ? "Guardando..." : "Marcar cobrado"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

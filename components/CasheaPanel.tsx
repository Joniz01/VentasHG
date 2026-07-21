"use client";

import { useEffect, useState } from "react";
import type { CasheaPagoItem } from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";
import { METODO_PAGO_LABELS } from "@/lib/types";

type EstadoFiltro = "PENDIENTE" | "LIQUIDADO" | "TODOS";

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function esVencida(item: CasheaPagoItem): boolean {
  return !item.liquidado && item.fechaVencimiento <= toIsoDate(new Date());
}

type ConfirmState = {
  ventaId: number;
  tasa: string;
  fechaPago: string;
};

function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

export default function CasheaPanel() {
  const [items, setItems] = useState<CasheaPagoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoFiltro>("PENDIENTE");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  async function loadItems(filtro: EstadoFiltro) {
    setLoading(true);
    setError(null);
    try {
      const param = filtro === "TODOS" ? "" : `?estado=${filtro}`;
      const res = await fetch(`/api/reportes/cashea${param}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar pagos Cashea");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems(estado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  function abrirConfirm(item: CasheaPagoItem) {
    setConfirm({ ventaId: item.ventaId, tasa: String(item.tasaDelDia ?? ""), fechaPago: hoyCaracas() });
  }

  async function handleToggleLiquidado(item: CasheaPagoItem, fechaPago?: string) {
    setUpdatingId(item.ventaId);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/cashea/${item.ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidado: !item.liquidado, fechaPago }),
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
      setConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setUpdatingId(null);
    }
  }

  const pendientes = items.filter((i) => !i.liquidado);
  const totalFinanciadoPendiente = pendientes.reduce((acc, i) => acc + i.montoFinanciado, 0);
  const totalInicialPendiente = pendientes.reduce((acc, i) => acc + i.montoInicial, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(["PENDIENTE", "LIQUIDADO", "TODOS"] as EstadoFiltro[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => { setEstado(e); setConfirm(null); }}
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
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <span className="font-medium text-zinc-600">Inicial cobrado pendiente: </span>
            <span className="font-semibold">${totalInicialPendiente.toFixed(2)}</span>
          </div>
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm">
            <span className="font-medium text-yellow-800">Financiado por Cashea (pendiente): </span>
            <span className="font-semibold text-yellow-900">${totalFinanciadoPendiente.toFixed(2)}</span>
          </div>
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
              <th className="px-4 py-2 text-right font-medium text-zinc-600">% inicial</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Cobrado (inicial)</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pago inicial</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Financiado</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Vence</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Estado</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-zinc-500">Cargando...</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-zinc-500">
                  No hay pagos Cashea
                </td>
              </tr>
            )}
            {!loading && items.map((item) => {
              const vencida = esVencida(item);
              const isConfirming = confirm?.ventaId === item.ventaId;
              const tasa = isConfirming ? Number(confirm.tasa) || 0 : 0;
              const montoBs = tasa > 0 ? item.montoFinanciado * tasa : null;
              const inicialBs = tasa > 0 ? item.montoInicial * tasa : null;

              return (
                <>
                  <tr key={item.ventaId} className={vencida ? "bg-red-50" : ""}>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">#{item.ventaId}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatFecha(item.fecha)}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">{item.cliente}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{item.porcentaje}%</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap font-medium">
                      ${item.montoInicial.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-zinc-600">
                      {item.metodoInicial ? METODO_PAGO_LABELS[item.metodoInicial as keyof typeof METODO_PAGO_LABELS] ?? item.metodoInicial : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap text-yellow-700 font-medium">
                      ${item.montoFinanciado.toFixed(2)}
                    </td>
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
                          Liquidado
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
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
                      ) : isConfirming ? (
                        <button
                          type="button"
                          onClick={() => setConfirm(null)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          onClick={() => abrirConfirm(item)}
                          disabled={updatingId === item.ventaId}
                          className="rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          Marcar pagado
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Panel de confirmación inline */}
                  {isConfirming && (
                    <tr key={`confirm-${item.ventaId}`}>
                      <td colSpan={10} className="px-4 py-3 bg-green-50 border-t border-green-200">
                        <div className="flex flex-wrap items-end gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-600">Tasa del día (Bs/USD)</label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              value={confirm.tasa}
                              onChange={(e) => setConfirm((c) => c ? { ...c, tasa: e.target.value } : c)}
                              className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-medium"
                              autoFocus
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-600">¿Cuándo entró el dinero?</label>
                            <input
                              type="date"
                              max={hoyCaracas()}
                              value={confirm.fechaPago}
                              onChange={(e) => setConfirm((c) => c ? { ...c, fechaPago: e.target.value } : c)}
                              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm font-medium"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-zinc-500">Inicial cobrado</span>
                            <span className="text-sm font-bold text-zinc-800">
                              ${item.montoInicial.toFixed(2)}
                              {inicialBs != null && (
                                <span className="ml-1.5 font-normal text-zinc-500">= Bs {inicialBs.toFixed(2)}</span>
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-yellow-700">Financiado por Cashea</span>
                            <span className="text-sm font-bold text-yellow-800">
                              ${item.montoFinanciado.toFixed(2)}
                              {montoBs != null && (
                                <span className="ml-1.5 font-normal text-yellow-600">= Bs {montoBs.toFixed(2)}</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={() => handleToggleLiquidado(item, confirm.fechaPago)}
                            disabled={updatingId === item.ventaId || !confirm.tasa || Number(confirm.tasa) <= 0}
                            className="rounded-md bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                          >
                            {updatingId === item.ventaId ? "Guardando..." : "Confirmar pago"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm(null)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

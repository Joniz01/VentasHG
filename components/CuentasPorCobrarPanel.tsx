"use client";

import { useEffect, useState, FormEvent } from "react";
import type { CuentaPorCobrarItem } from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";

type EstadoFiltro = "TODOS" | "COBRADA" | "PENDIENTE";

export default function CuentasPorCobrarPanel() {
  const [items, setItems] = useState<CuentaPorCobrarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [estado, setEstado] = useState<EstadoFiltro>("PENDIENTE");
  const [ventaId, setVentaId] = useState("");
  const [cliente, setCliente] = useState("");

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (estado !== "TODOS") params.set("cobrada", estado);
      if (ventaId.trim()) params.set("ventaId", ventaId.trim());
      if (cliente.trim()) params.set("cliente", cliente.trim());

      const res = await fetch(`/api/reportes/cuentas-por-cobrar?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al cargar las cuentas por cobrar");
      }
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las cuentas por cobrar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    loadItems();
  }

  async function handleToggleCobrada(item: CuentaPorCobrarItem) {
    setUpdatingId(item.ventaId);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/cuentas-por-cobrar/${item.ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuentaCobrada: !item.cuentaCobrada }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al actualizar el cobro");
      }
      setItems((prev) =>
        prev.map((it) =>
          it.ventaId === item.ventaId
            ? { ...it, cuentaCobrada: data.cuentaCobrada, cuentaCobradaAt: data.cuentaCobradaAt }
            : it
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el cobro");
    } finally {
      setUpdatingId(null);
    }
  }

  const totalUsd = items.reduce((acc, item) => acc + item.totalUsd, 0);
  const totalBs = items.reduce((acc, item) => acc + item.totalBs, 0);
  const pendientes = items.filter((item) => !item.cuentaCobrada);
  const totalPendienteUsd = pendientes.reduce((acc, item) => acc + item.totalUsd, 0);
  const totalPendienteBs = pendientes.reduce((acc, item) => acc + item.totalBs, 0);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">Estado</label>
            <select
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
            >
              <option value="TODOS">Todos</option>
              <option value="COBRADA">Pagadas</option>
              <option value="PENDIENTE">Pendientes</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">N° de pedido</label>
            <input
              className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              type="number"
              value={ventaId}
              onChange={(e) => setVentaId(e.target.value)}
              placeholder="Ej: 123"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">Cliente</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Buscando..." : "Filtrar"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          <span className="font-medium text-zinc-600">Total: </span>
          {totalBs.toFixed(2)} Bs <span className="text-zinc-500">(${totalUsd.toFixed(2)})</span>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm">
          <span className="font-medium text-yellow-800">Total pendiente: </span>
          {totalPendienteBs.toFixed(2)} Bs{" "}
          <span className="text-yellow-700">(${totalPendienteUsd.toFixed(2)})</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pedido #</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Fecha</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Teléfono</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Fecha límite</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Estado</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  No hay cuentas por cobrar que coincidan con los filtros
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading &&
              items.map((item) => (
                <tr key={item.ventaId}>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">#{item.ventaId}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatFecha(item.fecha)}</td>
                  <td className="px-4 py-2 whitespace-nowrap font-medium">{item.cliente}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{item.clienteTelefono ?? "-"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {item.totalBs.toFixed(2)} Bs{" "}
                    <span className="text-zinc-500">(${item.totalUsd.toFixed(2)})</span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {item.fechaLimitePago ? formatFecha(item.fechaLimitePago) : "-"}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {item.cuentaCobrada ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Pagada
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleToggleCobrada(item)}
                      disabled={updatingId === item.ventaId}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {item.cuentaCobrada ? "Marcar pendiente" : "Marcar pagada"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

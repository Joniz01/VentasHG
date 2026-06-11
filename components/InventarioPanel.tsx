"use client";

import { Fragment, useEffect, useState, FormEvent } from "react";
import type { MovimientoInventario, Producto } from "@/lib/types";

const TIPO_MOVIMIENTO_LABELS: Record<MovimientoInventario["tipo"], string> = {
  ENTRADA: "Entrada",
  AJUSTE: "Ajuste",
  VENTA: "Venta",
};

function formatFechaHora(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MovimientosProducto({ producto }: { producto: Producto }) {
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [stockActual, setStockActual] = useState(producto.stockActual);

  async function loadMovimientos() {
    try {
      const res = await fetch(`/api/productos/${producto.id}/inventario`);
      const data = (await res.json()) as MovimientoInventario[];
      setMovimientos(data);
    } catch {
      setError("No se pudo cargar el historial de inventario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cantidadNum = Number(cantidad);
    if (Number.isNaN(cantidadNum) || cantidadNum === 0) {
      setError("Indica una cantidad válida");
      return;
    }

    if (tipo === "ENTRADA" && cantidadNum <= 0) {
      setError("La cantidad de una entrada debe ser mayor a 0");
      return;
    }

    if (tipo === "AJUSTE" && !nota.trim()) {
      setError("Indica el motivo del ajuste");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/inventario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, cantidad: cantidadNum, nota: nota.trim() || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al registrar el movimiento");
      }

      setStockActual(data.stockActual);
      setCantidad("");
      setNota("");
      await loadMovimientos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el movimiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-zinc-700">
        Inventario de &quot;{producto.nombre}&quot; — Stock actual: {stockActual}
      </h4>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Tipo</label>
          <select
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ENTRADA" | "AJUSTE")}
          >
            <option value="ENTRADA">Entrada (agregar unidades)</option>
            <option value="AJUSTE">Ajuste (corrección)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">
            Cantidad {tipo === "AJUSTE" ? "(+ o -)" : ""}
          </label>
          <input
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            type="number"
            step="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder={tipo === "AJUSTE" ? "Ej: -2" : "Ej: 10"}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">
            Nota {tipo === "AJUSTE" ? "(obligatoria)" : "(opcional)"}
          </label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Motivo"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Registrar
        </button>
      </form>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Fecha</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Tipo</th>
              <th className="px-3 py-1.5 text-right font-medium text-zinc-600">Cantidad</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && movimientos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-zinc-500">
                  Sin movimientos registrados
                </td>
              </tr>
            )}
            {movimientos.map((mov) => (
              <tr key={mov.id}>
                <td className="px-3 py-1.5 whitespace-nowrap">{formatFechaHora(mov.createdAt)}</td>
                <td className="px-3 py-1.5">{TIPO_MOVIMIENTO_LABELS[mov.tipo]}</td>
                <td className="px-3 py-1.5 text-right">
                  {mov.cantidad > 0 ? `+${mov.cantidad}` : mov.cantidad}
                </td>
                <td className="px-3 py-1.5 text-zinc-600">{mov.nota ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventarioPanel({ productos }: { productos: Producto[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const productosInventario = productos.filter((p) => p.tipoProducto === "NORMAL");

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-zinc-600">Producto</th>
            <th className="px-4 py-2 text-left font-medium text-zinc-600">Categoría</th>
            <th className="px-4 py-2 text-right font-medium text-zinc-600">Stock actual</th>
            <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {productosInventario.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                No hay productos con inventario individual
              </td>
            </tr>
          )}
          {productosInventario.map((producto) => (
            <Fragment key={producto.id}>
              <tr>
                <td className="px-4 py-2 font-medium">{producto.nombre}</td>
                <td className="px-4 py-2 text-zinc-600">{producto.categoriaNombre ?? "-"}</td>
                <td className="px-4 py-2 text-right">{producto.stockActual}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setExpandedId(expandedId === producto.id ? null : producto.id)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                  >
                    {expandedId === producto.id ? "Ocultar" : "Movimientos"}
                  </button>
                </td>
              </tr>
              {expandedId === producto.id && (
                <tr>
                  <td colSpan={4} className="bg-zinc-50 px-4 py-3">
                    <MovimientosProducto producto={producto} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

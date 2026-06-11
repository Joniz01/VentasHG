"use client";

import { useState, FormEvent } from "react";
import type { Producto } from "@/lib/types";

export default function ProductoComponentesPanel({
  producto,
  productos,
  onChange,
}: {
  producto: Producto;
  productos: Producto[];
  onChange: () => Promise<void> | void;
}) {
  const [componenteId, setComponenteId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const asignadosIds = new Set(producto.componentes.map((c) => c.componenteId));
  const disponibles = productos.filter(
    (p) => p.id !== producto.id && p.tipoProducto === "NORMAL" && !asignadosIds.has(p.id)
  );

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!componenteId) {
      setError("Selecciona una bandeja");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/componentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componenteId: Number(componenteId),
          cantidad: Number(cantidad) || 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al agregar el componente");
      }

      setComponenteId("");
      setCantidad("1");
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar el componente");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCantidad(componente: Producto["componentes"][number]) {
    const nuevaCantidad = cantidades[componente.id];
    if (nuevaCantidad === undefined) return;

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/componentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componenteId: componente.componenteId,
          cantidad: Number(nuevaCantidad) || 1,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar el componente");
      }

      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el componente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(componenteRowId: number) {
    if (!confirm("¿Eliminar este componente del combo?")) return;

    try {
      const res = await fetch(`/api/productos/${producto.id}/componentes/${componenteRowId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar el componente");
      }
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el componente");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-zinc-700">
        Componentes (bandejas) que descuenta &quot;{producto.nombre}&quot; por unidad vendida
      </h4>

      {producto.componentes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {producto.componentes.map((componente) => (
            <li
              key={componente.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm"
            >
              <span>{componente.componenteNombre}</span>
              <div className="flex items-center gap-2">
                <input
                  className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={componente.cantidad}
                  onChange={(e) =>
                    setCantidades({ ...cantidades, [componente.id]: e.target.value })
                  }
                />
                <button
                  onClick={() => handleUpdateCantidad(componente)}
                  disabled={saving}
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => handleDelete(componente.id)}
                  className="rounded-md border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Bandeja</label>
          <select
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={componenteId}
            onChange={(e) => setComponenteId(e.target.value)}
          >
            <option value="">Selecciona una bandeja</option>
            {disponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.categoriaNombre ? `(${p.categoriaNombre})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Cantidad a descontar</label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            type="number"
            step="0.01"
            min="0"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="1"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Agregar componente
        </button>
      </form>

      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}

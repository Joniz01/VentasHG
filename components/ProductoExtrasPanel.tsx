"use client";

import { useEffect, useState, FormEvent } from "react";
import type { ExtraCatalogo, Producto } from "@/lib/types";

export default function ProductoExtrasPanel({
  producto,
  onChange,
}: {
  producto: Producto;
  onChange: () => Promise<void> | void;
}) {
  const [catalogo, setCatalogo] = useState<ExtraCatalogo[]>([]);
  const [extraId, setExtraId] = useState("");
  const [precioAdicional, setPrecioAdicional] = useState("");
  const [nuevoExtraNombre, setNuevoExtraNombre] = useState("");
  const [precios, setPrecios] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadCatalogo() {
    try {
      const res = await fetch("/api/extras");
      const data = await res.json();
      setCatalogo(data);
    } catch {
      setError("No se pudo cargar el catálogo de extras");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalogo();
  }, []);

  const asignadosIds = new Set(producto.extras.map((extra) => extra.extraId));
  const disponibles = catalogo.filter((extra) => !asignadosIds.has(extra.id));

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!extraId) {
      setError("Selecciona un extra del catálogo");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraId: Number(extraId),
          precioAdicional: Number(precioAdicional) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al agregar el extra");
      }

      setExtraId("");
      setPrecioAdicional("");
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar el extra");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCatalogo(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nuevoExtraNombre.trim()) {
      setError("El nombre del nuevo extra es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoExtraNombre.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al crear el extra");
      }

      setNuevoExtraNombre("");
      await loadCatalogo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el extra");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePrecio(extraAsignadoId: number, extraCatalogoId: number) {
    const nuevoPrecio = precios[extraAsignadoId];
    if (nuevoPrecio === undefined) return;

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraId: extraCatalogoId,
          precioAdicional: Number(nuevoPrecio) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar el extra");
      }

      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el extra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(extraId: number) {
    if (!confirm("¿Eliminar este extra del producto?")) return;

    try {
      const res = await fetch(`/api/productos/${producto.id}/extras/${extraId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar el extra");
      }
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el extra");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-zinc-700">
        Extras / presentaciones de &quot;{producto.nombre}&quot;
      </h4>

      {producto.extras.length > 0 && (
        <ul className="flex flex-col gap-1">
          {producto.extras.map((extra) => (
            <li
              key={extra.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm"
            >
              <span>{extra.nombre}</span>
              <div className="flex items-center gap-2">
                <input
                  className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-xs"
                  type="number"
                  step="0.01"
                  defaultValue={extra.precioAdicional}
                  onChange={(e) =>
                    setPrecios({ ...precios, [extra.id]: e.target.value })
                  }
                />
                <button
                  onClick={() => handleUpdatePrecio(extra.id, extra.extraId)}
                  disabled={saving}
                  className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => handleDelete(extra.id)}
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
          <label className="text-xs font-medium text-zinc-600">Extra del catálogo</label>
          <select
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={extraId}
            onChange={(e) => setExtraId(e.target.value)}
          >
            <option value="">Selecciona un extra</option>
            {disponibles.map((extra) => (
              <option key={extra.id} value={extra.id}>
                {extra.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Monto adicional</label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            type="number"
            step="0.01"
            value={precioAdicional}
            onChange={(e) => setPrecioAdicional(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Asignar extra
        </button>
      </form>

      <form onSubmit={handleAddCatalogo} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Nuevo extra del catálogo</label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={nuevoExtraNombre}
            onChange={(e) => setNuevoExtraNombre(e.target.value)}
            placeholder="Ej: Congelado"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
        >
          Agregar al catálogo
        </button>
      </form>

      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}

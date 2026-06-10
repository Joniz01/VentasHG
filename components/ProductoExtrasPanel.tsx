"use client";

import { useState, FormEvent } from "react";
import type { Producto } from "@/lib/types";

export default function ProductoExtrasPanel({
  producto,
  onChange,
}: {
  producto: Producto;
  onChange: () => Promise<void> | void;
}) {
  const [nombre, setNombre] = useState("");
  const [precioAdicional, setPrecioAdicional] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre del extra es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          precioAdicional: Number(precioAdicional) || 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al agregar el extra");
      }

      setNombre("");
      setPrecioAdicional("");
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar el extra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(extraId: number) {
    if (!confirm("¿Eliminar este extra?")) return;

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
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm"
            >
              <span>
                {extra.nombre}{" "}
                <span className="text-zinc-500">(+{extra.precioAdicional.toFixed(2)})</span>
              </span>
              <button
                onClick={() => handleDelete(extra.id)}
                className="rounded-md border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Nombre del extra</label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Frito"
          />
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
          Agregar extra
        </button>
      </form>

      {error && <div className="text-sm text-red-700">{error}</div>}
    </div>
  );
}

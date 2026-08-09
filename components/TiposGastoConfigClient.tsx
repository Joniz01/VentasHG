"use client";

import { useEffect, useState } from "react";
import type { TipoGastoCatalogo } from "@/lib/types";

export default function TiposGastoConfigClient() {
  const [tipos, setTipos] = useState<TipoGastoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tipos-gasto?all=1");
      const data = await res.json();
      setTipos(Array.isArray(data) ? data : []);
    } catch {
      setTipos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAgregar() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tipos-gasto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear el tipo de gasto");
      setNuevoNombre("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear el tipo de gasto");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo(tipo: TipoGastoCatalogo) {
    setError(null);
    try {
      const res = await fetch(`/api/tipos-gasto/${tipo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !tipo.activo }),
      });
      if (!res.ok) throw new Error("Error al actualizar el tipo de gasto");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el tipo de gasto");
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>
        Administra las categorías de "Tipo de gasto" disponibles al registrar un gasto operativo.
        Desactivar un tipo no elimina los gastos ya registrados con ese tipo.
      </p>

      <div className="flex gap-2">
        <input
          className="rounded-md border px-3 py-2 text-sm flex-1"
          style={{ borderColor: "var(--erp-border)" }}
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAgregar(); } }}
          placeholder="Nuevo tipo de gasto"
        />
        <button
          type="button"
          onClick={handleAgregar}
          disabled={saving || !nuevoNombre.trim()}
          className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--erp-primary)" }}
        >
          {saving ? "Agregando…" : "+ Agregar"}
        </button>
      </div>

      {error && <p className="text-sm" style={{ color: "#B91C1C" }}>{error}</p>}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--erp-bg)" }}>
              <th className="text-left px-3 py-2" style={{ color: "var(--erp-text-3)" }}>Nombre</th>
              <th className="text-left px-3 py-2" style={{ color: "var(--erp-text-3)" }}>Estado</th>
              <th className="text-right px-3 py-2" style={{ color: "var(--erp-text-3)" }}></th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--erp-border)" }}>
                <td className="px-3 py-2" style={{ color: "var(--erp-text)" }}>{t.nombre}</td>
                <td className="px-3 py-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={t.activo
                      ? { background: "#DCFCE7", color: "#166534" }
                      : { background: "#F3F4F6", color: "#6B7280" }}
                  >
                    {t.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggleActivo(t)}
                    className="text-xs px-2 py-1 rounded-md border"
                    style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
                  >
                    {t.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
            {tipos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-sm" style={{ color: "var(--erp-text-3)" }}>
                  No hay tipos de gasto registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

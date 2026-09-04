"use client";

import { useEffect, useState } from "react";

type CentroCosto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

export default function CentrosCostoConfigClient() {
  const [items, setItems] = useState<CentroCosto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editActivo, setEditActivo] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/centros-costo?activos=false");
      if (res.ok) setItems(await res.json());
    } catch {
      setError("No se pudieron cargar los centros de costo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/centros-costo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear");
      setNombre("");
      setDescripcion("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: number) {
    if (!editNombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/centros-costo/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: editNombre.trim(), descripcion: editDescripcion.trim() || null, activo: editActivo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al actualizar");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/centros-costo/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && (
        <div style={{ padding: "0.6rem 1rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", color: "#b91c1c", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "1rem", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "10px" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", margin: 0 }}>Nuevo Centro de Costo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem", alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Nombre *</label>
            <input
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--erp-border)" }}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Polanco, Margarita, Caracas"
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Descripción</label>
            <input
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--erp-border)" }}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !nombre.trim()}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--erp-primary)" }}
          >
            Agregar
          </button>
        </div>
      </form>

      {loading ? (
        <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)" }}>Sin centros de costo registrados.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map((c) => (
            <div key={c.id} style={{ padding: "0.75rem 1rem", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px", opacity: c.activo ? 1 : 0.55 }}>
              {editingId === c.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      style={{ borderColor: "var(--erp-border)" }}
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                    />
                    <input
                      className="rounded-md border px-2 py-1 text-sm"
                      style={{ borderColor: "var(--erp-border)" }}
                      value={editDescripcion}
                      onChange={(e) => setEditDescripcion(e.target.value)}
                      placeholder="Descripción"
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--erp-text-2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={editActivo} onChange={(e) => setEditActivo(e.target.checked)} />
                    Activo
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={() => handleUpdate(c.id)}
                      disabled={saving}
                      className="rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: "var(--erp-primary)" }}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md px-3 py-1 text-xs"
                      style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--erp-text)" }}>{c.nombre}</span>
                    {!c.activo && <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", color: "var(--erp-text-3)" }}>(inactivo)</span>}
                    {c.descripcion && (
                      <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--erp-text-2)" }}>{c.descripcion}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => { setEditingId(c.id); setEditNombre(c.nombre); setEditDescripcion(c.descripcion ?? ""); setEditActivo(c.activo); }}
                      className="rounded-md px-2 py-1 text-xs"
                      style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={saving}
                      className="rounded-md px-2 py-1 text-xs disabled:opacity-60"
                      style={{ border: "1px solid #fca5a5", color: "#b91c1c" }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

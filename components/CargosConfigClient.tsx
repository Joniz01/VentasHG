"use client";

import { useEffect, useState, type FormEvent } from "react";

type Cargo = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

type Form = { nombre: string; descripcion: string; activo: boolean };
const EMPTY: Form = { nombre: "", descripcion: "", activo: true };

export default function CargosConfigClient() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cargos?activos=false");
      setCargos(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setShowForm(false);
    setError(null);
  }

  function startEdit(c: Cargo) {
    setEditingId(c.id);
    setForm({ nombre: c.nombre, descripcion: c.descripcion ?? "", activo: c.activo });
    setShowForm(true);
    setError(null);
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/cargos/${editingId}` : "/api/cargos", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este cargo?")) return;
    const res = await fetch(`/api/cargos/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      if (data.desactivado) alert("El cargo está en uso y fue desactivado.");
      await load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setForm({ ...EMPTY }); setEditingId(null); setShowForm((v) => !v); setError(null); }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--erp-accent)" }}
        >
          {showForm && !editingId ? "Cancelar" : "+ Nuevo Cargo"}
        </button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Nombre <span className="text-red-500">*</span></label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Cocinero"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Descripción</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
          </div>
          {editingId && (
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--erp-text)" }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} />
              Activo
            </label>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={reset} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}>Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--erp-primary)" }}>
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear Cargo"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : cargos.length === 0 ? (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)", color: "var(--erp-text)" }}>
          No hay cargos registrados. Crea el primero.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--erp-text-2)" }}>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Descripción</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr
                  key={c.id}
                  className="border-t"
                  style={{ borderColor: "var(--erp-border)", opacity: c.activo ? 1 : 0.55 }}
                >
                  <td className="px-3 py-2 font-medium" style={{ color: "var(--erp-text)" }}>
                    {c.nombre}
                    {!c.activo && <span className="ml-2 text-xs font-normal" style={{ color: "var(--erp-text-2)" }}>(inactivo)</span>}
                  </td>
                  <td className="px-3 py-2" style={{ color: "var(--erp-text-2)" }}>{c.descripcion ?? "—"}</td>
                  <td className="px-3 py-2" style={{ color: "var(--erp-text-2)" }}>{c.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(c)} className="text-xs" style={{ color: "var(--erp-primary)" }}>Editar</button>
                      <button type="button" onClick={() => handleDelete(c.id)} className="text-xs text-red-600">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

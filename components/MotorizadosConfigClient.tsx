"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Motorizado, MotorizadoInput } from "@/lib/types";

const EMPTY_FORM: MotorizadoInput = {
  nombre: "",
  apellido: "",
  telefono: "",
  usuario: "",
  clave: "",
};

export default function MotorizadosConfigClient() {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MotorizadoInput>({ ...EMPTY_FORM });
  const [showClave, setShowClave] = useState(false);

  async function loadMotorizados() {
    try {
      const res = await fetch("/api/motorizados");
      setMotorizados(await res.json());
    } catch {
      setError("No se pudieron cargar los motorizados");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMotorizados();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowClave(false);
  }

  function startEdit(motorizado: Motorizado) {
    setEditingId(motorizado.id);
    setForm({
      nombre: motorizado.nombre,
      apellido: motorizado.apellido ?? "",
      telefono: motorizado.telefono ?? "",
      usuario: motorizado.usuario,
      clave: "",
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nombre.trim() || !form.usuario.trim() || (!editingId && !form.clave.trim())) {
      setError("Nombre, usuario y clave son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/motorizados/${editingId}` : "/api/motorizados", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          telefono: form.telefono.trim(),
          usuario: form.usuario.trim(),
          clave: form.clave,
          activo: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar el motorizado");
      }

      resetForm();
      await loadMotorizados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el motorizado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este motorizado?")) return;
    try {
      const res = await fetch(`/api/motorizados/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar el motorizado");
      }
      await loadMotorizados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el motorizado");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Nombre *</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Apellido</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.apellido}
              onChange={(e) => setForm((prev) => ({ ...prev, apellido: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Teléfono</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.telefono}
              onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Usuario *</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.usuario}
              onChange={(e) => setForm((prev) => ({ ...prev, usuario: e.target.value }))}
              autoComplete="off"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">
              Clave {editingId ? "(dejar en blanco para no cambiar)" : "*"}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showClave ? "text" : "password"}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.clave}
                onChange={(e) => setForm((prev) => ({ ...prev, clave: e.target.value }))}
                autoComplete="new-password"
                required={!editingId}
                style={{ paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowClave((v) => !v)}
                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--erp-text-3)" }}
                tabIndex={-1}
                aria-label={showClave ? "Ocultar clave" : "Ver clave"}
              >
                {showClave ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Crear motorizado"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Nombre</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Teléfono</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Usuario</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && motorizados.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No hay motorizados registrados
                </td>
              </tr>
            )}
            {motorizados.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium whitespace-nowrap">
                  {m.nombre} {m.apellido ?? ""}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{m.telefono ?? "-"}</td>
                <td className="px-4 py-2 whitespace-nowrap">{m.usuario}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(m)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  PERMISOS_VACIOS,
  PERMISO_TABS,
  ROLES,
  ROL_LABELS,
  type Usuario,
  type UsuarioInput,
} from "@/lib/types";

const EMPTY_FORM: UsuarioInput = {
  nombre: "",
  usuario: "",
  clave: "",
  rol: "USUARIO",
  permisos: { ...PERMISOS_VACIOS },
};

type Props = {
  usuarioActualId: number;
};

export default function UsuariosConfigClient({ usuarioActualId }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UsuarioInput>({ ...EMPTY_FORM, permisos: { ...PERMISOS_VACIOS } });

  async function loadUsuarios() {
    try {
      const res = await fetch("/api/usuarios");
      setUsuarios(await res.json());
    } catch {
      setError("No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsuarios();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, permisos: { ...PERMISOS_VACIOS } });
  }

  function startEdit(usuario: Usuario) {
    setEditingId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      clave: "",
      rol: usuario.rol,
      permisos: { ...usuario.permisos },
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
      const res = await fetch(editingId ? `/api/usuarios/${editingId}` : "/api/usuarios", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          usuario: form.usuario.trim(),
          clave: form.clave,
          rol: form.rol,
          permisos: form.permisos,
          activo: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar el usuario");
      }

      resetForm();
      await loadUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el usuario");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar el usuario");
      }
      await loadUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el usuario");
    }
  }

  async function handleToggleActivo(usuario: Usuario) {
    if (usuario.id === usuarioActualId) return;
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: usuario.nombre,
          usuario: usuario.usuario,
          rol: usuario.rol,
          permisos: usuario.permisos,
          activo: !usuario.activo,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar el usuario");
      }
      await loadUsuarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el usuario");
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
            <label className="text-sm font-medium text-zinc-700">Usuario *</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.usuario}
              onChange={(e) => setForm((prev) => ({ ...prev, usuario: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">
              Clave {editingId ? "(dejar en blanco para no cambiar)" : "*"}
            </label>
            <input
              type="password"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.clave}
              onChange={(e) => setForm((prev) => ({ ...prev, clave: e.target.value }))}
              required={!editingId}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Rol *</label>
            <select
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.rol}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, rol: e.target.value as UsuarioInput["rol"] }))
              }
              disabled={editingId === usuarioActualId}
            >
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ROL_LABELS[rol]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.rol === "USUARIO" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">Permisos de acceso</label>
            <div className="flex flex-wrap gap-4">
              {PERMISO_TABS.map((tab) => (
                <label key={tab.key} className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.permisos[tab.key]}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        permisos: { ...prev.permisos, [tab.key]: e.target.checked },
                      }))
                    }
                  />
                  {tab.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {form.rol === "ADMIN" && (
          <p className="text-sm text-zinc-500">
            Los administradores tienen acceso total al sistema.
          </p>
        )}

        {error && (
          <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Crear usuario"}
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
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Usuario</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Rol</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Permisos</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Estado</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && usuarios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No hay usuarios registrados
                </td>
              </tr>
            )}
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 font-medium whitespace-nowrap">{u.nombre}</td>
                <td className="px-4 py-2 whitespace-nowrap">{u.usuario}</td>
                <td className="px-4 py-2 whitespace-nowrap">{ROL_LABELS[u.rol]}</td>
                <td className="px-4 py-2">
                  {u.rol === "ADMIN"
                    ? "Total"
                    : PERMISO_TABS.filter((tab) => u.permisos[tab.key])
                        .map((tab) => tab.label)
                        .join(", ") || "Ninguno"}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{u.activo ? "Activo" : "Inactivo"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => startEdit(u)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                    >
                      Editar
                    </button>
                    {u.id !== usuarioActualId && (
                      <button
                        onClick={() => handleToggleActivo(u)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                    {u.id !== usuarioActualId && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    )}
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

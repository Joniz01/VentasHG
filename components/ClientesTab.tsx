"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Cliente, ClienteInput, ClientesConfig, Rol } from "@/lib/types";
import { CLIENTES_CONFIG_DEFAULT } from "@/lib/types";
import { validarCedulaRif } from "@/lib/validacion";

const EMPTY_FORM: ClienteInput = {
  nombre: "",
  cedula: "",
  direccion: "",
  telefono: "",
};

type Props = {
  rol: Rol | null;
};

export default function ClientesTab({ rol }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClienteInput>({ ...EMPTY_FORM });

  const [config, setConfig] = useState<ClientesConfig>(CLIENTES_CONFIG_DEFAULT);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);

  async function loadClientes() {
    setLoading(true);
    try {
      const res = await fetch("/api/clientes");
      setClientes(await res.json());
    } catch {
      setError("No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/clientes-config");
      if (res.ok) {
        setConfig((await res.json()) as ClientesConfig);
      }
    } catch {
      // se mantiene la configuración por defecto
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClientes();
    loadConfig();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function startEdit(cliente: Cliente) {
    setEditingId(cliente.id);
    setForm({
      nombre: cliente.nombre,
      cedula: cliente.cedula ?? "",
      direccion: cliente.direccion ?? "",
      telefono: cliente.telefono ?? "",
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nombre = form.nombre.trim();
    if (!nombre) {
      setError("El nombre es obligatorio");
      return;
    }

    const errorCedula = validarCedulaRif(form.cedula);
    if (errorCedula) {
      setError(errorCedula);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/clientes/${editingId}` : "/api/clientes", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          cedula: form.cedula.trim(),
          direccion: form.direccion.trim(),
          telefono: form.telefono.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar el cliente");
      }

      resetForm();
      await loadClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este cliente?")) return;
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar el cliente");
      }
      await loadClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el cliente");
    }
  }

  async function handleGuardarConfig() {
    setConfigSaving(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      const res = await fetch("/api/clientes-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        throw new Error("No se pudo guardar la configuración");
      }
      const data = (await res.json()) as ClientesConfig;
      setConfig(data);
      setConfigSuccess("Configuración guardada correctamente");
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setConfigSaving(false);
    }
  }

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.cedula ?? "").toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {rol === "ADMIN" && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-800">
            Datos obligatorios al registrar una venta
          </h3>
          <p className="text-xs text-zinc-500">
            Aplica para todos los usuarios al registrar nuevas ventas.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={config.cedulaObligatoria}
                onChange={(e) => setConfig((prev) => ({ ...prev, cedulaObligatoria: e.target.checked }))}
              />
              C.I/Rif obligatorio
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={config.telefonoObligatorio}
                onChange={(e) => setConfig((prev) => ({ ...prev, telefonoObligatorio: e.target.checked }))}
              />
              Teléfono obligatorio
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={config.direccionObligatoria}
                onChange={(e) => setConfig((prev) => ({ ...prev, direccionObligatoria: e.target.checked }))}
              />
              Dirección obligatoria
            </label>
          </div>
          {configError && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{configError}</div>
          )}
          {configSuccess && (
            <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{configSuccess}</div>
          )}
          <button
            type="button"
            onClick={handleGuardarConfig}
            disabled={configSaving}
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {configSaving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-800">
          {editingId ? "Editar cliente" : "Nuevo cliente"}
        </h3>
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
            <label className="text-sm font-medium text-zinc-700">C.I/Rif</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.cedula}
              onChange={(e) => setForm((prev) => ({ ...prev, cedula: e.target.value }))}
              placeholder="Ej: 12345678 o V12345678"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Teléfono</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.telefono}
              onChange={(e) => setForm((prev) => ({ ...prev, telefono: e.target.value }))}
              placeholder="Ej: 584129002211"
            />
            <span className="text-xs text-zinc-500">
              Formato: código de país + número, sin espacios ni símbolos (Ej: 584129002211)
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Dirección</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.direccion}
              onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))}
            />
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
            {editingId ? "Guardar cambios" : "Crear cliente"}
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

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label className="text-sm font-medium text-zinc-700">Buscar</label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, C.I/Rif o teléfono"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Nombre</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">C.I/Rif</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Teléfono</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Dirección</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && clientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  No hay clientes registrados
                </td>
              </tr>
            )}
            {!loading &&
              clientesFiltrados.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{c.nombre}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{c.cedula ?? "-"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{c.telefono ?? "-"}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{c.direccion ?? "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(c)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
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

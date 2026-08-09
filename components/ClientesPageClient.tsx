"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Cliente, ClienteInput, ClientesConfig, Rol } from "@/lib/types";
import { CLIENTES_CONFIG_DEFAULT } from "@/lib/types";
import { validarCedulaRif } from "@/lib/validacion";

const EMPTY_FORM: ClienteInput & { esProveedor: boolean } = { nombre: "", cedula: "", direccion: "", telefono: "", esProveedor: false };
const PAGE_SIZES = [5, 10, 25, 50];

type Vista = null | "lista" | "crear";

type Props = { rol: Rol | null };

const inputSt: React.CSSProperties = {
  padding: "0.4rem 0.65rem",
  border: "1px solid var(--erp-border)",
  borderRadius: "6px",
  background: "var(--erp-bg)",
  color: "var(--erp-text)",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const pgBtnSt: React.CSSProperties = {
  padding: "0.2rem 0.55rem",
  border: "1px solid var(--erp-border)",
  borderRadius: "5px",
  cursor: "pointer",
  background: "transparent",
  color: "var(--erp-text-2)",
  fontSize: "0.8rem",
};

export default function ClientesPageClient({ rol }: Props) {
  const [vista, setVista] = useState<Vista>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClienteInput & { esProveedor: boolean }>({ ...EMPTY_FORM });
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [config, setConfig] = useState<ClientesConfig>(CLIENTES_CONFIG_DEFAULT);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

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
      if (res.ok) setConfig(await res.json());
    } catch { /* mantener default */ }
  }

  useEffect(() => {
    if (vista === "lista") { loadClientes(); loadConfig(); }
    if (vista === "crear") loadConfig();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setFormSuccess(null);
  }

  function startEdit(c: Cliente & { esProveedor?: boolean }) {
    setEditingId(c.id);
    setForm({ nombre: c.nombre, cedula: c.cedula ?? "", direccion: c.direccion ?? "", telefono: c.telefono ?? "", esProveedor: c.esProveedor ?? false });
    setError(null);
    setFormSuccess(null);
    setVista("crear");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFormSuccess(null);
    const nombre = form.nombre.trim();
    if (!nombre) { setError("El nombre es obligatorio"); return; }
    const errorCedula = validarCedulaRif(form.cedula);
    if (errorCedula) { setError(errorCedula); return; }

    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/clientes/${editingId}` : "/api/clientes", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, cedula: form.cedula.trim(), direccion: form.direccion.trim(), telefono: form.telefono.trim(), esProveedor: form.esProveedor }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar el cliente");
      }
      setFormSuccess(editingId ? "Cliente actualizado correctamente" : "Cliente creado correctamente");
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Error al eliminar"); }
      await loadClientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el cliente");
    }
  }

  async function handleGuardarConfig() {
    setConfigSaving(true); setConfigMsg(null);
    try {
      const res = await fetch("/api/clientes-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      if (!res.ok) throw new Error("No se pudo guardar");
      setConfig(await res.json());
      setConfigMsg({ ok: true, text: "Configuración guardada" });
    } catch (err) {
      setConfigMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
    } finally { setConfigSaving(false); }
  }

  async function handleSync() {
    setSyncing(true); setConfigMsg(null);
    try {
      const res = await fetch("/api/admin/sync-clientes", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al sincronizar");
      setConfigMsg({ ok: true, text: `Sincronización completada (${data.sincronizados as number} ventas procesadas)` });
      await loadClientes();
    } catch (err) {
      setConfigMsg({ ok: false, text: err instanceof Error ? err.message : "Error" });
    } finally { setSyncing(false); }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) =>
      c.nombre.toLowerCase().includes(q) ||
      (c.cedula ?? "").toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtrados.slice((safePage - 1) * pageSize, safePage * pageSize);

  /* ── MENU PRINCIPAL ── */
  if (!vista) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--erp-text)" }}>CRM · Clientes</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem", maxWidth: 520 }}>
          {[
            { key: "lista",  icon: "👥", title: "Clientes Creados",  desc: "Ver y gestionar la lista de clientes" },
            { key: "crear",  icon: "➕", title: "Crear Cliente",      desc: "Registrar un nuevo cliente" },
          ].map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => { resetForm(); setVista(card.key as Vista); }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.4rem",
                padding: "1rem 1.1rem",
                background: "var(--erp-surface)",
                border: "1px solid var(--erp-border)",
                borderRadius: "10px",
                cursor: "pointer", textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--erp-primary)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 3px var(--erp-primary-lt)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--erp-border)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{card.icon}</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--erp-text)" }}>{card.title}</span>
              <span style={{ fontSize: "0.775rem", color: "var(--erp-text-2)", lineHeight: 1.35 }}>{card.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── CABECERA COMPARTIDA ── */
  const Header = ({ title }: { title: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
      <button
        type="button"
        onClick={() => { resetForm(); setVista(null); }}
        style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.35rem 0.75rem", background: "transparent", border: "1px solid var(--erp-border)", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", color: "var(--erp-text-2)" }}
      >
        ← Volver
      </button>
      <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--erp-text)" }}>{title}</span>
    </div>
  );

  /* ── LISTA DE CLIENTES ── */
  if (vista === "lista") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Header title="👥 Clientes Creados" />

        {/* Config ADMIN */}
        {rol === "ADMIN" && (
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--erp-text)" }}>Datos obligatorios en ventas</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              {([
                { key: "cedulaObligatoria", label: "C.I/Rif obligatorio" },
                { key: "telefonoObligatorio", label: "Teléfono obligatorio" },
                { key: "direccionObligatoria", label: "Dirección obligatoria" },
              ] as const).map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--erp-text)", cursor: "pointer" }}>
                  <input type="checkbox" checked={config[key]} onChange={(e) => setConfig((p) => ({ ...p, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            {configMsg && <p style={{ fontSize: "0.8rem", color: configMsg.ok ? "#166534" : "#b91c1c", margin: 0 }}>{configMsg.text}</p>}
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" onClick={handleGuardarConfig} disabled={configSaving} style={{ padding: "0.35rem 0.9rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", opacity: configSaving ? 0.7 : 1 }}>
                {configSaving ? "Guardando..." : "Guardar config"}
              </button>
              <button type="button" onClick={handleSync} disabled={syncing} style={{ padding: "0.35rem 0.9rem", background: "transparent", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: "6px", fontSize: "0.8rem", cursor: "pointer", opacity: syncing ? 0.7 : 1 }}>
                {syncing ? "Sincronizando..." : "Importar de ventas"}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input type="search" placeholder="Buscar por nombre, C.I/Rif o teléfono..." value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} style={{ ...inputSt, width: "auto", minWidth: 220, flex: 1 }} />
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ ...inputSt, width: "auto" }}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} por página</option>)}
          </select>
          <button type="button" onClick={() => { resetForm(); setVista("crear"); }} style={{ padding: "0.4rem 0.9rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "6px", fontSize: "0.825rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            + Nuevo cliente
          </button>
        </div>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#b91c1c", fontSize: "0.825rem" }}>{error}</div>}

        {/* Table */}
        <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--erp-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--erp-surface)", borderBottom: "1px solid var(--erp-border)" }}>
                {["Nombre", "C.I/Rif", "Teléfono", "Dirección", "Proveedor", "Acciones"].map((h) => (
                  <th key={h} style={{ padding: "0.6rem 0.875rem", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)" }}>No hay clientes registrados</td></tr>
              ) : paged.map((c, idx) => {
                const cp = c as Cliente & { esProveedor?: boolean };
                return (
                <tr key={c.id} style={{ borderBottom: idx < paged.length - 1 ? "1px solid var(--erp-border)" : "none" }}>
                  <td style={{ padding: "0.6rem 0.875rem", fontWeight: 500, whiteSpace: "nowrap" }}>{c.nombre}</td>
                  <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{c.cedula ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{c.telefono ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)" }}>{c.direccion ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.875rem", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const nuevo = !(cp.esProveedor ?? false);
                        await fetch(`/api/clientes/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ esProveedor: nuevo }) });
                        setClientes(prev => prev.map(x => x.id === c.id ? { ...x, esProveedor: nuevo } as typeof x : x));
                      }}
                      title={cp.esProveedor ? "Quitar etiqueta proveedor" : "Marcar como proveedor"}
                      style={{ padding: "0.2rem 0.6rem", borderRadius: 99, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", border: "1px solid", background: cp.esProveedor ? "var(--erp-primary-lt)" : "transparent", color: cp.esProveedor ? "var(--erp-primary)" : "var(--erp-text-3)", borderColor: cp.esProveedor ? "var(--erp-primary)" : "var(--erp-border)" }}
                    >
                      {cp.esProveedor ? "Proveedor" : "+ Marcar"}
                    </button>
                  </td>
                  <td style={{ padding: "0.6rem 0.875rem" }}>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <button onClick={() => startEdit(cp)} style={{ padding: "0.25rem 0.65rem", background: "transparent", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: "5px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 500 }}>Editar</button>
                      <button onClick={() => handleDelete(c.id)} style={{ padding: "0.25rem 0.65rem", background: "transparent", color: "#b91c1c", border: "1px solid #fca5a5", borderRadius: "5px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 500 }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.825rem", color: "var(--erp-text-2)", flexWrap: "wrap" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={pgBtnSt}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)} style={{ ...pgBtnSt, background: n === safePage ? "var(--erp-primary)" : "transparent", color: n === safePage ? "#fff" : "var(--erp-text-2)", borderColor: n === safePage ? "var(--erp-primary)" : "var(--erp-border)" }}>{n}</button>
            ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={pgBtnSt}>›</button>
            <span style={{ marginLeft: "0.5rem" }}>{filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>
    );
  }

  /* ── CREAR / EDITAR CLIENTE ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 560 }}>
      <Header title={editingId ? "✏️ Editar Cliente" : "➕ Crear Cliente"} />

      <form onSubmit={handleSubmit} style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px", padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.65rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Nombre *</span>
            <input style={inputSt} value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>C.I / Rif</span>
            <input style={inputSt} value={form.cedula} onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))} placeholder="Ej: 12345678 o V12345678" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Teléfono</span>
            <input style={inputSt} value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} placeholder="Ej: 584129002211" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Dirección</span>
            <input style={inputSt} value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))} />
          </label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--erp-text)", cursor: "pointer", padding: "0.5rem 0.65rem", background: form.esProveedor ? "var(--erp-primary-lt)" : "var(--erp-bg)", borderRadius: 6, border: "1px solid", borderColor: form.esProveedor ? "var(--erp-primary)" : "var(--erp-border)" }}>
          <input type="checkbox" checked={form.esProveedor} onChange={(e) => setForm((p) => ({ ...p, esProveedor: e.target.checked }))} />
          <span>Es proveedor <span style={{ color: "var(--erp-text-3)", fontWeight: 400 }}>— aparecerá en la búsqueda al registrar compras</span></span>
        </label>

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#b91c1c", fontSize: "0.825rem" }}>{error}</div>}
        {formSuccess && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#166534", fontSize: "0.825rem" }}>{formSuccess}</div>}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" disabled={saving} style={{ padding: "0.4rem 1.1rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cliente"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} disabled={saving} style={{ padding: "0.4rem 1rem", background: "transparent", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem" }}>
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

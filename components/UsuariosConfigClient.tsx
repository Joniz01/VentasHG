"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
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

const PAGE_SIZES = [5, 10, 25, 50];

type Props = {
  usuarioActualId: number;
};

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
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
  );

export default function UsuariosConfigClient({ usuarioActualId }: Props) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UsuarioInput>({ ...EMPTY_FORM, permisos: { ...PERMISOS_VACIOS } });
  const [showClave, setShowClave] = useState(false);

  const [search, setSearch] = useState("");
  const [filterRol, setFilterRol] = useState<string>("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

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
    setShowClave(false);
    setShowForm(false);
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
    setShowForm(true);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usuarios.filter((u) => {
      const matchSearch = !q || u.nombre.toLowerCase().includes(q) || u.usuario.toLowerCase().includes(q);
      const matchRol = !filterRol || u.rol === filterRol;
      return matchSearch && matchRol;
    });
  }, [usuarios, search, filterRol]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function onFilterChange(fn: () => void) {
    fn();
    setPage(1);
  }

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Create button / form toggle */}
      {!showForm && (
        <button
          type="button"
          onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, permisos: { ...PERMISOS_VACIOS } }); setShowForm(true); }}
          style={{
            alignSelf: "flex-start",
            padding: "0.45rem 1.1rem",
            background: "var(--erp-primary)",
            color: "#fff",
            border: "none",
            borderRadius: "7px",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          + Crear Usuario
        </button>
      )}

      {showForm && (
        <div
          style={{
            background: "var(--erp-surface)",
            border: "1px solid var(--erp-border)",
            borderRadius: "8px",
            padding: "1.1rem",
          }}
        >
          <h3 style={{ margin: "0 0 0.85rem 0", fontSize: "0.95rem", fontWeight: 600, color: "var(--erp-text)" }}>
            {editingId ? "Editar Usuario" : "Nuevo Usuario"}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Nombre *</span>
                <input style={inputSt} value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Usuario *</span>
                <input style={inputSt} value={form.usuario} onChange={(e) => setForm((p) => ({ ...p, usuario: e.target.value }))} autoComplete="off" required />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>
                  Clave {editingId ? "(vacío = no cambiar)" : "*"}
                </span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showClave ? "text" : "password"}
                    style={{ ...inputSt, paddingRight: 36 }}
                    value={form.clave}
                    onChange={(e) => setForm((p) => ({ ...p, clave: e.target.value }))}
                    autoComplete="new-password"
                    required={!editingId}
                  />
                  <button
                    type="button"
                    onClick={() => setShowClave((v) => !v)}
                    tabIndex={-1}
                    style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--erp-text-3)" }}
                  >
                    <EyeIcon open={showClave} />
                  </button>
                </div>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Rol *</span>
                <select
                  style={inputSt}
                  value={form.rol}
                  onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as UsuarioInput["rol"] }))}
                  disabled={editingId === usuarioActualId}
                >
                  {ROLES.map((rol) => <option key={rol} value={rol}>{ROL_LABELS[rol]}</option>)}
                </select>
              </label>
            </div>

            {form.rol === "USUARIO" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Permisos de acceso</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  {PERMISO_TABS.map((t) => (
                    <label key={t.key} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--erp-text)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={form.permisos[t.key]}
                        onChange={(e) => setForm((p) => ({ ...p, permisos: { ...p.permisos, [t.key]: e.target.checked } }))}
                      />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.rol === "ADMIN" && (
              <p style={{ fontSize: "0.825rem", color: "var(--erp-text-2)" }}>Los administradores tienen acceso total al sistema.</p>
            )}

            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#b91c1c", fontSize: "0.825rem" }}>{error}</div>}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "0.4rem 1.1rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 600, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear usuario"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{ padding: "0.4rem 1rem", background: "transparent", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem" }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          placeholder="Buscar por nombre o usuario..."
          value={search}
          onChange={(e) => onFilterChange(() => setSearch(e.target.value))}
          style={{ ...inputSt, width: "auto", minWidth: 200, flex: 1 }}
        />
        <select
          value={filterRol}
          onChange={(e) => onFilterChange(() => setFilterRol(e.target.value))}
          style={{ ...inputSt, width: "auto", minWidth: 120 }}
        >
          <option value="">Todos los roles</option>
          {ROLES.map((rol) => <option key={rol} value={rol}>{ROL_LABELS[rol]}</option>)}
        </select>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ ...inputSt, width: "auto" }}
        >
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} por página</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--erp-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "var(--erp-surface)", borderBottom: "1px solid var(--erp-border)" }}>
              {["Nombre", "Usuario", "Rol", "Permisos", "Estado", "Acciones"].map((h) => (
                <th key={h} style={{ padding: "0.6rem 0.875rem", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)" }}>No hay usuarios</td></tr>
            ) : paged.map((u, idx) => (
              <tr key={u.id} style={{ borderBottom: idx < paged.length - 1 ? "1px solid var(--erp-border)" : "none" }}>
                <td style={{ padding: "0.6rem 0.875rem", fontWeight: 500, whiteSpace: "nowrap" }}>{u.nombre}</td>
                <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{u.usuario}</td>
                <td style={{ padding: "0.6rem 0.875rem", whiteSpace: "nowrap" }}>{ROL_LABELS[u.rol]}</td>
                <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)", fontSize: "0.8rem" }}>
                  {u.rol === "ADMIN" ? "Total" : PERMISO_TABS.filter((t) => u.permisos[t.key]).map((t) => t.label).join(", ") || "Ninguno"}
                </td>
                <td style={{ padding: "0.6rem 0.875rem", whiteSpace: "nowrap" }}>
                  <span style={{
                    padding: "0.2rem 0.55rem", borderRadius: "20px", fontSize: "0.75rem", fontWeight: 600,
                    background: u.activo ? "#dcfce7" : "#fee2e2",
                    color: u.activo ? "#166534" : "#991b1b",
                  }}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ padding: "0.6rem 0.875rem" }}>
                  <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                    <button onClick={() => startEdit(u)} style={btnSt}>Editar</button>
                    {u.id !== usuarioActualId && (
                      <button onClick={() => handleToggleActivo(u)} style={btnSt}>
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    )}
                    {u.id !== usuarioActualId && (
                      <button onClick={() => handleDelete(u.id)} style={btnDangerSt}>Eliminar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.825rem", color: "var(--erp-text-2)" }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={pgBtnSt}>‹</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPage(n)} style={{ ...pgBtnSt, background: n === safePage ? "var(--erp-primary)" : "transparent", color: n === safePage ? "#fff" : "var(--erp-text-2)", borderColor: n === safePage ? "var(--erp-primary)" : "var(--erp-border)" }}>
              {n}
            </button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={pgBtnSt}>›</button>
          <span style={{ marginLeft: "0.5rem" }}>{filtered.length} usuario{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

const btnSt: React.CSSProperties = {
  padding: "0.25rem 0.65rem",
  background: "transparent",
  color: "var(--erp-text-2)",
  border: "1px solid var(--erp-border)",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const btnDangerSt: React.CSSProperties = {
  ...btnSt,
  color: "#b91c1c",
  borderColor: "#fca5a5",
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

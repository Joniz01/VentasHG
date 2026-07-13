"use client";

import { useEffect, useState, useMemo, type FormEvent } from "react";
import type { Motorizado, MotorizadoInput } from "@/lib/types";

const EMPTY_FORM: MotorizadoInput = {
  nombre: "",
  apellido: "",
  telefono: "",
  usuario: "",
  clave: "",
};

const PAGE_SIZES = [5, 10, 25, 50];

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

export default function MotorizadosConfigClient() {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MotorizadoInput>({ ...EMPTY_FORM });
  const [showClave, setShowClave] = useState(false);

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

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
    setShowForm(false);
  }

  function startEdit(m: Motorizado) {
    setEditingId(m.id);
    setForm({ nombre: m.nombre, apellido: m.apellido ?? "", telefono: m.telefono ?? "", usuario: m.usuario, clave: "" });
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return motorizados;
    return motorizados.filter((m) =>
      m.nombre.toLowerCase().includes(q) ||
      (m.apellido ?? "").toLowerCase().includes(q) ||
      m.usuario.toLowerCase().includes(q)
    );
  }, [motorizados, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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
      {!showForm && (
        <button
          type="button"
          onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }}
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
          + Crear Motorizado
        </button>
      )}

      {showForm && (
        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px", padding: "1.1rem" }}>
          <h3 style={{ margin: "0 0 0.85rem 0", fontSize: "0.95rem", fontWeight: 600, color: "var(--erp-text)" }}>
            {editingId ? "Editar Motorizado" : "Nuevo Motorizado"}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.65rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Nombre *</span>
                <input style={inputSt} value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Apellido</span>
                <input style={inputSt} value={form.apellido} onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Teléfono</span>
                <input style={inputSt} value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
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
            </div>

            {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", color: "#b91c1c", fontSize: "0.825rem" }}>{error}</div>}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: "0.4rem 1.1rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 600, opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear motorizado"}
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
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ ...inputSt, width: "auto", minWidth: 200, flex: 1 }}
        />
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
              {["Nombre", "Teléfono", "Usuario", "Acciones"].map((h) => (
                <th key={h} style={{ padding: "0.6rem 0.875rem", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)" }}>No hay motorizados registrados</td></tr>
            ) : paged.map((m, idx) => (
              <tr key={m.id} style={{ borderBottom: idx < paged.length - 1 ? "1px solid var(--erp-border)" : "none" }}>
                <td style={{ padding: "0.6rem 0.875rem", fontWeight: 500, whiteSpace: "nowrap" }}>{m.nombre} {m.apellido ?? ""}</td>
                <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{m.telefono ?? "—"}</td>
                <td style={{ padding: "0.6rem 0.875rem", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{m.usuario}</td>
                <td style={{ padding: "0.6rem 0.875rem" }}>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button onClick={() => startEdit(m)} style={btnSt}>Editar</button>
                    <button onClick={() => handleDelete(m.id)} style={btnDangerSt}>Eliminar</button>
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
          <span style={{ marginLeft: "0.5rem" }}>{filtered.length} motorizado{filtered.length !== 1 ? "s" : ""}</span>
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

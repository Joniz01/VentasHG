"use client";

import { useState, useEffect, useCallback } from "react";
import type { ConteoUsuario } from "@/lib/types";

const cell: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--erp-border)",
  fontSize: "0.875rem",
  color: "var(--erp-text)",
};

export default function ConteoUsuariosConfigClient() {
  const [usuarios, setUsuarios] = useState<ConteoUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: "", usuario: "", clave: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ nombre: "", usuario: "", clave: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [showClave, setShowClave] = useState(false);
  const [showEditClave, setShowEditClave] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/conteo-usuarios");
    if (res.ok) setUsuarios(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/conteo-usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ nombre: "", usuario: "", clave: "" });
      await load();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al crear");
    }
    setSaving(false);
  }

  async function toggleActivo(u: ConteoUsuario) {
    await fetch(`/api/conteo-usuarios/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !u.activo }),
    });
    await load();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    const body: Record<string, string> = {};
    if (editForm.nombre.trim()) body.nombre = editForm.nombre.trim();
    if (editForm.usuario.trim()) body.usuario = editForm.usuario.trim();
    if (editForm.clave.trim()) body.clave = editForm.clave.trim();
    await fetch(`/api/conteo-usuarios/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditId(null);
    setEditForm({ nombre: "", usuario: "", clave: "" });
    setEditSaving(false);
    await load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Formulario alta */}
      <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", color: "var(--erp-text)", fontWeight: 600 }}>
          Nuevo Usuario de Conteo
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.5rem" }}>
          {(["nombre", "usuario"] as const).map((field) => (
            <input
              key={field}
              type="text"
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              required
              style={{ padding: "0.5rem 0.75rem", border: "1px solid var(--erp-border)", borderRadius: "6px", fontSize: "0.875rem", background: "var(--erp-bg)", color: "var(--erp-text)" }}
            />
          ))}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <input
              type={showClave ? "text" : "password"}
              placeholder="Clave"
              value={form.clave}
              onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))}
              required
              style={{ width: "100%", padding: "0.5rem 2.25rem 0.5rem 0.75rem", border: "1px solid var(--erp-border)", borderRadius: "6px", fontSize: "0.875rem", background: "var(--erp-bg)", color: "var(--erp-text)", boxSizing: "border-box" }}
            />
            <button type="button" onClick={() => setShowClave((v) => !v)} tabIndex={-1} style={{ position: "absolute", right: "0.5rem", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--erp-text-3)", display: "flex", alignItems: "center" }}>
              {showClave
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--erp-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {saving ? "..." : "Agregar"}
          </button>
        </div>
        {error && <p style={{ color: "#dc2626", margin: 0, fontSize: "0.8rem" }}>{error}</p>}
      </form>

      {/* Tabla */}
      {loading ? (
        <p style={{ color: "var(--erp-text-2)", fontSize: "0.875rem" }}>Cargando…</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--erp-surface)" }}>
                {["Nombre", "Usuario", "Estado", "Acciones"].map((h) => (
                  <th key={h} style={{ ...cell, fontWeight: 600, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...cell, color: "var(--erp-text-3)", textAlign: "center", padding: "1.5rem" }}>
                    Sin usuarios de conteo
                  </td>
                </tr>
              )}
              {usuarios.map((u) => (
                <>
                  <tr key={u.id}>
                    <td style={cell}>{u.nombre}</td>
                    <td style={{ ...cell, fontFamily: "monospace" }}>{u.usuario}</td>
                    <td style={cell}>
                      <span style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "99px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: u.activo ? "#dcfce7" : "#fee2e2",
                        color: u.activo ? "#166534" : "#991b1b",
                      }}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ ...cell, display: "flex", gap: "0.4rem" }}>
                      <button
                        type="button"
                        onClick={() => { setEditId(u.id); setEditForm({ nombre: u.nombre, usuario: u.usuario, clave: "" }); }}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.775rem", cursor: "pointer", border: "1px solid var(--erp-border)", borderRadius: "5px", background: "var(--erp-surface)", color: "var(--erp-text)" }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActivo(u)}
                        style={{ padding: "0.25rem 0.6rem", fontSize: "0.775rem", cursor: "pointer", border: "1px solid var(--erp-border)", borderRadius: "5px", background: "var(--erp-surface)", color: u.activo ? "#dc2626" : "#166534" }}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                  {editId === u.id && (
                    <tr key={`edit-${u.id}`}>
                      <td colSpan={4} style={{ ...cell, background: "var(--erp-surface)" }}>
                        <form onSubmit={handleEdit} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          <input
                            placeholder="Nombre"
                            value={editForm.nombre}
                            onChange={(e) => setEditForm((f) => ({ ...f, nombre: e.target.value }))}
                            style={{ padding: "0.4rem 0.6rem", border: "1px solid var(--erp-border)", borderRadius: "5px", fontSize: "0.875rem", background: "var(--erp-bg)", color: "var(--erp-text)" }}
                          />
                          <input
                            placeholder="Usuario"
                            value={editForm.usuario}
                            onChange={(e) => setEditForm((f) => ({ ...f, usuario: e.target.value }))}
                            style={{ padding: "0.4rem 0.6rem", border: "1px solid var(--erp-border)", borderRadius: "5px", fontSize: "0.875rem", background: "var(--erp-bg)", color: "var(--erp-text)" }}
                          />
                          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <input
                              type={showEditClave ? "text" : "password"}
                              placeholder="Nueva clave (opcional)"
                              value={editForm.clave}
                              onChange={(e) => setEditForm((f) => ({ ...f, clave: e.target.value }))}
                              style={{ padding: "0.4rem 2rem 0.4rem 0.6rem", border: "1px solid var(--erp-border)", borderRadius: "5px", fontSize: "0.875rem", background: "var(--erp-bg)", color: "var(--erp-text)", boxSizing: "border-box" }}
                            />
                            <button type="button" onClick={() => setShowEditClave((v) => !v)} tabIndex={-1} style={{ position: "absolute", right: "0.4rem", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--erp-text-3)", display: "flex", alignItems: "center" }}>
                              {showEditClave
                                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              }
                            </button>
                          </div>
                          <button type="submit" disabled={editSaving} style={{ padding: "0.4rem 0.8rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "0.875rem" }}>
                            {editSaving ? "..." : "Guardar"}
                          </button>
                          <button type="button" onClick={() => setEditId(null)} style={{ padding: "0.4rem 0.8rem", border: "1px solid var(--erp-border)", borderRadius: "5px", cursor: "pointer", fontSize: "0.875rem", background: "var(--erp-surface)", color: "var(--erp-text)" }}>
                            Cancelar
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

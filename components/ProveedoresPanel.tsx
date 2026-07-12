"use client";

import { useEffect, useState, useCallback } from "react";

interface Proveedor {
  id: number | string;
  nombre: string;
  rif_ci?: string;
  direccion?: string;
  telefono?: string;
  diasCredito?: number;
}

interface FormData {
  nombre: string;
  rifCi: string;
  direccion: string;
  telefono: string;
  diasCredito: string;
}

const emptyForm: FormData = {
  nombre: "",
  rifCi: "",
  direccion: "",
  telefono: "",
  diasCredito: "0",
};

export default function ProveedoresPanel() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const fetchProveedores = useCallback(async (q = "") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proveedores${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      setProveedores(Array.isArray(data) ? data : data.proveedores ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProveedores(search);
  }, [fetchProveedores, search]);

  function openNew() {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEdit(p: Proveedor) {
    setEditingId(p.id);
    setFormData({
      nombre: p.nombre ?? "",
      rifCi: p.rif_ci ?? "",
      direccion: p.direccion ?? "",
      telefono: p.telefono ?? "",
      diasCredito: p.diasCredito != null ? String(p.diasCredito) : "0",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nombre.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        nombre: formData.nombre.trim(),
        rif_ci: formData.rifCi.trim() || undefined,
        direccion: formData.direccion.trim() || undefined,
        telefono: formData.telefono.trim() || undefined,
        diasCredito: formData.diasCredito !== "" ? Number(formData.diasCredito) : 0,
      };

      let res: Response;
      if (editingId != null) {
        res = await fetch(`/api/proveedores/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/proveedores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Error ${res.status}`);
      }

      closeForm();
      await fetchProveedores(search);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ fontFamily: "inherit", color: "var(--erp-text)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "var(--erp-text)" }}>
          Proveedores
        </h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "0.4rem 0.75rem",
              border: "1px solid var(--erp-border)",
              borderRadius: "6px",
              background: "var(--erp-bg)",
              color: "var(--erp-text)",
              fontSize: "0.875rem",
              outline: "none",
              minWidth: "180px",
            }}
          />
          <button
            onClick={openNew}
            style={{
              padding: "0.4rem 1rem",
              background: "var(--erp-primary)",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            + Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div
          style={{
            background: "var(--erp-surface)",
            border: "1px solid var(--erp-border)",
            borderRadius: "8px",
            padding: "1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "0.95rem", fontWeight: 600, color: "var(--erp-text)" }}>
            {editingId != null ? "Editar Proveedor" : "Nuevo Proveedor"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <label style={labelStyle}>
                <span style={labelTextStyle}>Nombre *</span>
                <input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                  placeholder="Nombre del proveedor"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>RIF / CI</span>
                <input
                  name="rifCi"
                  value={formData.rifCi}
                  onChange={handleChange}
                  placeholder="J-12345678-9"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Teléfono</span>
                <input
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="0414-0000000"
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                <span style={labelTextStyle}>Días de crédito</span>
                <input
                  name="diasCredito"
                  type="number"
                  min={0}
                  value={formData.diasCredito}
                  onChange={handleChange}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
                <span style={labelTextStyle}>Dirección</span>
                <input
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleChange}
                  placeholder="Dirección"
                  style={inputStyle}
                />
              </label>
            </div>

            {error && (
              <p style={{ color: "#e53e3e", fontSize: "0.825rem", margin: "0 0 0.75rem 0" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: "0.4rem 1.1rem",
                  background: "var(--erp-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                style={{
                  padding: "0.4rem 1rem",
                  background: "transparent",
                  color: "var(--erp-text-2)",
                  border: "1px solid var(--erp-border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error general (fuera del form) */}
      {error && !showForm && (
        <p style={{ color: "#e53e3e", fontSize: "0.875rem", marginBottom: "0.75rem" }}>{error}</p>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: "8px", border: "1px solid var(--erp-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr
              style={{
                background: "var(--erp-surface)",
                borderBottom: "1px solid var(--erp-border)",
              }}
            >
              {["Nombre", "RIF / CI", "Teléfono", "Días crédito", "Acciones"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "0.65rem 0.875rem",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--erp-text-2)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={centeredCellStyle}>
                  Cargando...
                </td>
              </tr>
            ) : proveedores.length === 0 ? (
              <tr>
                <td colSpan={5} style={centeredCellStyle}>
                  No hay proveedores registrados.
                </td>
              </tr>
            ) : (
              proveedores.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: idx < proveedores.length - 1 ? "1px solid var(--erp-border)" : "none",
                    background: editingId === p.id ? "var(--erp-primary-lt)" : "transparent",
                  }}
                >
                  <td style={cellStyle}>{p.nombre}</td>
                  <td style={{ ...cellStyle, color: "var(--erp-text-2)" }}>{p.rif_ci ?? "—"}</td>
                  <td style={{ ...cellStyle, color: "var(--erp-text-2)" }}>{p.telefono ?? "—"}</td>
                  <td style={{ ...cellStyle, color: "var(--erp-text-2)", textAlign: "center" }}>
                    {p.diasCredito != null ? p.diasCredito : "—"}
                  </td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{
                        padding: "0.3rem 0.75rem",
                        background: "transparent",
                        color: "var(--erp-primary)",
                        border: "1px solid var(--erp-primary)",
                        borderRadius: "5px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && proveedores.length > 0 && (
        <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--erp-text-3)" }}>
          {proveedores.length} proveedor{proveedores.length !== 1 ? "es" : ""}
        </p>
      )}
    </div>
  );
}

// Shared style objects
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
};

const labelTextStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "var(--erp-text-2)",
};

const inputStyle: React.CSSProperties = {
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

const cellStyle: React.CSSProperties = {
  padding: "0.65rem 0.875rem",
  verticalAlign: "middle",
};

const centeredCellStyle: React.CSSProperties = {
  padding: "2rem",
  textAlign: "center",
  color: "var(--erp-text-3)",
};

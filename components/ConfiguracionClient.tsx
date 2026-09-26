"use client";

import { useEffect, useState } from "react";
import type { Familia, Linea, UnidadMedida } from "@/lib/types";

type Tab = "unidades" | "familias" | "lineas";

const TIPOS_UM = ["UNIDAD", "MASA", "VOLUMEN", "LONGITUD"] as const;
const TIPO_UM_LABELS: Record<string, string> = {
  UNIDAD: "Unidad",
  MASA: "Masa",
  VOLUMEN: "Volumen",
  LONGITUD: "Longitud",
};

export default function ConfiguracionClient() {
  const [tab, setTab] = useState<Tab>("unidades");

  // ── Unidades de medida ────────────────────────────────────────────────────
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [umNombre, setUmNombre] = useState("");
  const [umAbreviatura, setUmAbreviatura] = useState("");
  const [umTipo, setUmTipo] = useState<string>("UNIDAD");
  const [umSaving, setUmSaving] = useState(false);
  const [umError, setUmError] = useState<string | null>(null);
  const [umDeleting, setUmDeleting] = useState<number | null>(null);
  const [umDeleteError, setUmDeleteError] = useState<string | null>(null);

  // ── Familias ─────────────────────────────────────────────────────────────
  const [familias, setFamilias] = useState<(Familia & { grupo?: string })[]>([]);
  const [famNombre, setFamNombre] = useState("");
  const [famOrden, setFamOrden] = useState("99");
  const [famGrupo, setFamGrupo] = useState("PARA_LA_VENTA");
  const [famSaving, setFamSaving] = useState(false);
  const [famError, setFamError] = useState<string | null>(null);
  const [famDeleting, setFamDeleting] = useState<number | null>(null);
  const [famDeleteError, setFamDeleteError] = useState<string | null>(null);

  // ── Líneas ────────────────────────────────────────────────────────────────
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaNombre, setLineaNombre] = useState("");
  const [lineaFamiliaId, setLineaFamiliaId] = useState("");
  const [lineaSaving, setLineaSaving] = useState(false);
  const [lineaError, setLineaError] = useState<string | null>(null);
  const [lineaDeleting, setLineaDeleting] = useState<number | null>(null);
  const [lineaDeleteError, setLineaDeleteError] = useState<string | null>(null);

  async function loadUnidades() {
    const res = await fetch("/api/unidades-medida");
    if (res.ok) setUnidades(await res.json());
  }

  async function loadFamilias() {
    const res = await fetch("/api/categorias?grupo=TODOS");
    if (!res.ok) {
      // fallback: load both grupos separately
      const [r1, r2] = await Promise.all([
        fetch("/api/categorias"),
        fetch("/api/categorias?grupo=MATERIA_PRIMA"),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      const map = new Map<number, Familia & { grupo?: string }>();
      (d1 as Familia[]).forEach((f) => map.set(f.id, { ...f, grupo: "PARA_LA_VENTA" }));
      (d2 as Familia[]).forEach((f) => map.set(f.id, { ...f, grupo: "MATERIA_PRIMA" }));
      setFamilias(Array.from(map.values()).sort((a, b) => (a.nombre > b.nombre ? 1 : -1)));
    } else {
      setFamilias(await res.json());
    }
  }

  async function loadLineas() {
    const res = await fetch("/api/lineas");
    if (res.ok) setLineas(await res.json());
  }

  useEffect(() => {
    loadUnidades();
    loadFamilias();
    loadLineas();
  }, []);

  // ── Handlers unidades ─────────────────────────────────────────────────────
  async function handleCrearUnidad() {
    if (!umNombre.trim() || !umAbreviatura.trim()) return;
    setUmSaving(true);
    setUmError(null);
    try {
      const res = await fetch("/api/unidades-medida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: umNombre.trim(), abreviatura: umAbreviatura.trim(), tipo: umTipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear");
      await loadUnidades();
      setUmNombre(""); setUmAbreviatura(""); setUmTipo("UNIDAD");
    } catch (err) {
      setUmError(err instanceof Error ? err.message : "Error");
    } finally {
      setUmSaving(false);
    }
  }

  async function handleEliminarUnidad(id: number, nombre: string) {
    if (!confirm(`¿Eliminar la unidad "${nombre}"?`)) return;
    setUmDeleting(id);
    setUmDeleteError(null);
    try {
      const res = await fetch(`/api/unidades-medida/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      await loadUnidades();
    } catch (err) {
      setUmDeleteError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setUmDeleting(null);
    }
  }

  // ── Handlers familias ─────────────────────────────────────────────────────
  async function handleCrearFamilia() {
    if (!famNombre.trim()) return;
    setFamSaving(true);
    setFamError(null);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: famNombre.trim(), orden: Number(famOrden) || 99, grupo: famGrupo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear");
      await loadFamilias();
      setFamNombre(""); setFamOrden("99");
    } catch (err) {
      setFamError(err instanceof Error ? err.message : "Error");
    } finally {
      setFamSaving(false);
    }
  }

  async function handleEliminarFamilia(id: number, nombre: string) {
    if (!confirm(`¿Eliminar la familia "${nombre}"?`)) return;
    setFamDeleting(id);
    setFamDeleteError(null);
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      await loadFamilias();
      await loadLineas();
    } catch (err) {
      setFamDeleteError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setFamDeleting(null);
    }
  }

  // ── Handlers líneas ────────────────────────────────────────────────────────
  async function handleCrearLinea() {
    if (!lineaNombre.trim() || !lineaFamiliaId) return;
    setLineaSaving(true);
    setLineaError(null);
    try {
      const res = await fetch("/api/lineas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: lineaNombre.trim(), familiaId: Number(lineaFamiliaId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear");
      await loadLineas();
      setLineaNombre("");
    } catch (err) {
      setLineaError(err instanceof Error ? err.message : "Error");
    } finally {
      setLineaSaving(false);
    }
  }

  async function handleEliminarLinea(id: number, nombre: string) {
    if (!confirm(`¿Eliminar la línea "${nombre}"?`)) return;
    setLineaDeleting(id);
    setLineaDeleteError(null);
    try {
      const res = await fetch(`/api/lineas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al eliminar");
      await loadLineas();
    } catch (err) {
      setLineaDeleteError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setLineaDeleting(null);
    }
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const inputStyle = {
    border: "1px solid var(--erp-border)",
    borderRadius: 6,
    padding: "7px 10px",
    fontSize: 13,
    background: "var(--erp-surface)",
    color: "var(--erp-text)",
  };

  const btnPrimary = {
    background: "var(--erp-primary)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  const btnDanger = {
    background: "transparent",
    color: "#dc2626",
    border: "1px solid #dc2626",
    borderRadius: 5,
    padding: "3px 8px",
    fontSize: 11,
    cursor: "pointer",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "8px 10px",
    borderBottom: "2px solid var(--erp-border)",
    color: "var(--erp-text-3)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderBottom: "1px solid var(--erp-border)",
    color: "var(--erp-text)",
    verticalAlign: "middle",
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "unidades", label: "Unidades de Medida", icon: "📐" },
    { key: "familias", label: "Familias",           icon: "🗂️" },
    { key: "lineas",   label: "Líneas",             icon: "📋" },
  ];

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--erp-text)", marginBottom: 4 }}>
        ⚙️ Configuración · Maestros
      </h1>
      <p style={{ fontSize: 13, color: "var(--erp-text-3)", marginBottom: 24 }}>
        Tablas de referencia utilizadas en todo el sistema. Solo administradores.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid var(--erp-border)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--erp-primary)" : "2px solid transparent",
              marginBottom: -2,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "var(--erp-primary)" : "var(--erp-text-2)",
              cursor: "pointer",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── UNIDADES DE MEDIDA ─────────────────────────────────────────────── */}
      {tab === "unidades" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Formulario nueva unidad */}
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)", marginBottom: 14 }}>Nueva unidad de medida</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>NOMBRE</label>
                <input style={inputStyle} value={umNombre} onChange={(e) => setUmNombre(e.target.value)} placeholder="Ej: Kilogramo" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>ABREVIATURA</label>
                <input style={inputStyle} value={umAbreviatura} onChange={(e) => setUmAbreviatura(e.target.value)} placeholder="Ej: kg" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>TIPO</label>
                <select style={inputStyle} value={umTipo} onChange={(e) => setUmTipo(e.target.value)}>
                  {TIPOS_UM.map((t) => <option key={t} value={t}>{TIPO_UM_LABELS[t]}</option>)}
                </select>
              </div>
              <button style={btnPrimary} onClick={handleCrearUnidad} disabled={umSaving}>
                {umSaving ? "…" : "Agregar"}
              </button>
            </div>
            {umError && <p style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>{umError}</p>}
          </div>

          {/* Lista */}
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
            {umDeleteError && (
              <div style={{ padding: "10px 16px", background: "#fef2f2", borderBottom: "1px solid var(--erp-border)", fontSize: 12, color: "#dc2626" }}>
                {umDeleteError}
              </div>
            )}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Abreviatura</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={{ ...thStyle, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>{u.nombre}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 600 }}>{u.abreviatura}</td>
                    <td style={{ ...tdStyle, color: "var(--erp-text-3)" }}>{TIPO_UM_LABELS[u.tipo] ?? u.tipo}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        style={btnDanger}
                        disabled={umDeleting === u.id}
                        onClick={() => handleEliminarUnidad(u.id, u.nombre)}
                      >
                        {umDeleting === u.id ? "…" : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {unidades.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "var(--erp-text-3)" }}>Sin unidades registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FAMILIAS ───────────────────────────────────────────────────────── */}
      {tab === "familias" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)", marginBottom: 14 }}>Nueva familia</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr auto", gap: 10, alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>NOMBRE</label>
                <input style={inputStyle} value={famNombre} onChange={(e) => setFamNombre(e.target.value)} placeholder="Ej: Especiales" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>ORDEN</label>
                <input style={inputStyle} type="number" min="1" value={famOrden} onChange={(e) => setFamOrden(e.target.value)} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>GRUPO</label>
                <select style={inputStyle} value={famGrupo} onChange={(e) => setFamGrupo(e.target.value)}>
                  <option value="PARA_LA_VENTA">Para la Venta</option>
                  <option value="MATERIA_PRIMA">Materia Prima</option>
                </select>
              </div>
              <button style={btnPrimary} onClick={handleCrearFamilia} disabled={famSaving}>
                {famSaving ? "…" : "Agregar"}
              </button>
            </div>
            {famError && <p style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>{famError}</p>}
          </div>

          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
            {famDeleteError && (
              <div style={{ padding: "10px 16px", background: "#fef2f2", borderBottom: "1px solid var(--erp-border)", fontSize: 12, color: "#dc2626" }}>
                {famDeleteError}
              </div>
            )}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Grupo</th>
                  <th style={thStyle}>Orden</th>
                  <th style={{ ...thStyle, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {familias.map((f) => (
                  <tr key={f.id}>
                    <td style={tdStyle}>{f.nombre}</td>
                    <td style={{ ...tdStyle, color: "var(--erp-text-3)" }}>
                      {f.grupo === "MATERIA_PRIMA" ? "Materia Prima" : "Para la Venta"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--erp-text-3)" }}>{f.orden ?? 99}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        style={btnDanger}
                        disabled={famDeleting === f.id}
                        onClick={() => handleEliminarFamilia(f.id, f.nombre)}
                      >
                        {famDeleting === f.id ? "…" : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
                {familias.length === 0 && (
                  <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "var(--erp-text-3)" }}>Sin familias registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LÍNEAS ─────────────────────────────────────────────────────────── */}
      {tab === "lineas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)", marginBottom: 14 }}>Nueva línea</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>NOMBRE</label>
                <input style={inputStyle} value={lineaNombre} onChange={(e) => setLineaNombre(e.target.value)} placeholder="Ej: Fritos" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 600 }}>FAMILIA</label>
                <select style={inputStyle} value={lineaFamiliaId} onChange={(e) => setLineaFamiliaId(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {familias.map((f) => (
                    <option key={f.id} value={String(f.id)}>{f.nombre} ({f.grupo === "MATERIA_PRIMA" ? "MP" : "Venta"})</option>
                  ))}
                </select>
              </div>
              <button style={btnPrimary} onClick={handleCrearLinea} disabled={lineaSaving || !lineaFamiliaId}>
                {lineaSaving ? "…" : "Agregar"}
              </button>
            </div>
            {lineaError && <p style={{ marginTop: 8, fontSize: 12, color: "#dc2626" }}>{lineaError}</p>}
          </div>

          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
            {lineaDeleteError && (
              <div style={{ padding: "10px 16px", background: "#fef2f2", borderBottom: "1px solid var(--erp-border)", fontSize: 12, color: "#dc2626" }}>
                {lineaDeleteError}
              </div>
            )}
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Línea</th>
                  <th style={thStyle}>Familia</th>
                  <th style={{ ...thStyle, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => {
                  const fam = familias.find((f) => f.id === l.familiaId);
                  return (
                    <tr key={l.id}>
                      <td style={tdStyle}>{l.nombre}</td>
                      <td style={{ ...tdStyle, color: "var(--erp-text-3)" }}>{fam?.nombre ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        <button
                          style={btnDanger}
                          disabled={lineaDeleting === l.id}
                          onClick={() => handleEliminarLinea(l.id, l.nombre)}
                        >
                          {lineaDeleting === l.id ? "…" : "Eliminar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lineas.length === 0 && (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "var(--erp-text-3)" }}>Sin líneas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

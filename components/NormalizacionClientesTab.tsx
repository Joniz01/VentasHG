"use client";

import { useEffect, useState, useCallback } from "react";

type ClienteRow = {
  id: number;
  nombreOriginal: string;
  apellidoDb: string | null;
  normalizado: boolean;
  normalizadoAt: string | null;
  normalizadoPor: string | null;
  propNombre: string;
  propApellido: string;
  flagged: boolean;
};

type Stats = { total: number; aprobados: number; flagged: number; pendientes: number };

type Filtro = "todos" | "pendientes" | "flagged" | "aprobados";

function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

const S: Record<string, React.CSSProperties> = {
  label: { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)" },
  input: { padding: "5px 8px", border: "1.5px solid var(--erp-primary)", borderRadius: 6, fontSize: 12.5, background: "var(--erp-surface)", color: "var(--erp-text)", fontFamily: "inherit", width: "100%" },
};

export default function NormalizacionClientesTab() {
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, aprobados: 0, flagged: 0, pendientes: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clientes-normalizar");
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setRows(data.rows);
      setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function aprobar(row: ClienteRow) {
    setSaving(row.id);
    try {
      const res = await fetch(`/api/admin/clientes-normalizar/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: row.propNombre, apellido: row.propApellido }),
      });
      if (!res.ok) throw new Error("Error al aprobar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  }

  function startEdit(row: ClienteRow) {
    setEditingId(row.id);
    setEditNombre(row.propNombre);
    setEditApellido(row.propApellido);
  }

  async function guardarEdit(id: number) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/clientes-normalizar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: toTitleCase(editNombre), apellido: toTitleCase(editApellido) }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  }

  async function bulkApprove() {
    if (!confirm(`¿Aprobar automáticamente todos los clientes con nombre simple (2 palabras)? Esta acción no se puede deshacer.`)) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/admin/clientes-normalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk-approve-simple" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBulkResult(`✓ ${data.updated} clientes aprobados correctamente.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkLoading(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (filtro === "aprobados") return r.normalizado;
    if (filtro === "flagged") return r.flagged;
    if (filtro === "pendientes") return !r.normalizado;
    return true;
  });

  const pct = stats.total > 0 ? Math.round((stats.aprobados / stats.total) * 100) : 0;
  const pendSimples = stats.pendientes; // non-flagged, non-normalized

  const cellP: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid var(--erp-border)", verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[
          { val: stats.total, label: "Total", color: "var(--erp-text)" },
          { val: stats.aprobados, label: "Aprobados", color: "#15803D" },
          { val: pendSimples, label: "Por aprobar", color: "#0369A1" },
          { val: stats.flagged, label: "Requieren revisión", color: "#92400E" },
        ].map((k) => (
          <div key={k.label} style={{ background: "var(--erp-surface)", border: "1.5px solid var(--erp-border)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 3 }}>{k.val}</div>
            <div style={{ ...S.label }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barra de progreso */}
      <div style={{ background: "var(--erp-surface)", border: "1.5px solid var(--erp-border)", borderRadius: 10, padding: "12px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--erp-text-3)", marginBottom: 7 }}>
          <span>Progreso de normalización</span>
          <span style={{ fontWeight: 700, color: "var(--erp-text)" }}>{stats.aprobados} / {stats.total} ({pct}%)</span>
        </div>
        <div style={{ height: 8, background: "var(--erp-border)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${pct}%`, background: "#15803D", transition: "width .4s" }} />
          <div style={{ width: `${stats.total > 0 ? Math.round((stats.flagged / stats.total) * 100) : 0}%`, background: "#FCD34D" }} />
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          {[{ color: "#15803D", label: "Aprobados" }, { color: "#FCD34D", label: "Requieren revisión" }, { color: "var(--erp-border)", label: "Pendientes" }].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--erp-text-2)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Info + bulk */}
      {pendSimples > 0 && (
        <div style={{ background: "#E0F2FE", border: "1.5px solid #7DD3FC", borderRadius: 10, padding: "11px 14px", fontSize: 12, color: "#0369A1", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ flex: 1 }}>💡 <strong>{pendSimples} clientes con nombre simple</strong> (2 palabras) pueden aprobarse en un clic.</span>
          <button
            type="button"
            onClick={bulkApprove}
            disabled={bulkLoading}
            style={{ padding: "6px 14px", background: "#0369A1", color: "#fff", border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", opacity: bulkLoading ? 0.6 : 1 }}
          >{bulkLoading ? "Aprobando…" : `✓ Aprobar todos los simples (${pendSimples})`}</button>
        </div>
      )}

      {bulkResult && (
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, color: "#15803D", fontWeight: 600 }}>{bulkResult}</div>
      )}

      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "9px 13px", fontSize: 12.5, color: "#DC2626" }}>{error}</div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([
          { key: "todos", label: `Todos (${stats.total})` },
          { key: "flagged", label: `⚠ Revisar (${stats.flagged})` },
          { key: "pendientes", label: `📋 Pendientes (${stats.pendientes + pendSimples})` },
          { key: "aprobados", label: `✓ Aprobados (${stats.aprobados})` },
        ] as { key: Filtro; label: string }[]).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            style={{
              padding: "5px 12px", border: "1.5px solid", borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: "pointer",
              background: filtro === f.key ? "var(--erp-primary)" : "var(--erp-surface)",
              color: filtro === f.key ? "#fff" : "var(--erp-text-2)",
              borderColor: filtro === f.key ? "var(--erp-primary)" : "var(--erp-border)",
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Cargando clientes…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "24px 0", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>No hay clientes en este filtro.</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1.5px solid var(--erp-border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["#", "Nombre en DB", "Nombre →", "← Apellido", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)", borderBottom: "1.5px solid var(--erp-border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const isEditing = editingId === row.id;
                const rowBg = row.normalizado ? "#FAFFFE" : row.flagged ? "#FFFEF5" : "var(--erp-surface)";
                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--erp-border)", background: isEditing ? "var(--erp-primary-lt)" : rowBg }}>
                    <td style={{ ...cellP, color: "var(--erp-text-3)", fontVariantNumeric: "tabular-nums", width: 40 }}>{row.id}</td>
                    <td style={cellP}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--erp-text-3)", background: "var(--erp-bg)", padding: "2px 7px", borderRadius: 4 }}>{row.nombreOriginal}{row.apellidoDb ? ` ${row.apellidoDb}` : ""}</span>
                    </td>
                    {isEditing ? (
                      <td style={cellP} colSpan={2}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input style={S.input} value={editNombre} onChange={(e) => setEditNombre(e.target.value)} onBlur={() => setEditNombre(toTitleCase(editNombre))} placeholder="Nombre" />
                          <input style={S.input} value={editApellido} onChange={(e) => setEditApellido(e.target.value)} onBlur={() => setEditApellido(toTitleCase(editApellido))} placeholder="Apellido" />
                        </div>
                      </td>
                    ) : (
                      <>
                        <td style={{ ...cellP, fontWeight: 700, color: row.normalizado ? "#15803D" : row.flagged ? "#92400E" : "#0369A1" }}>{row.propNombre}</td>
                        <td style={{ ...cellP, fontWeight: 600, color: row.normalizado ? "#0369A1" : row.flagged ? "#92400E" : "#0369A1" }}>{row.propApellido || <span style={{ color: "var(--erp-text-3)" }}>—</span>}</td>
                      </>
                    )}
                    <td style={cellP}>
                      {row.normalizado ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: "#F0FDF4", color: "#15803D" }}>✓ Aprobado</span>
                      ) : row.flagged ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: "#FFFBEB", color: "#92400E" }}>⚠ Revisar</span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: "#E0F2FE", color: "#0369A1" }}>📋 Pendiente</span>
                      )}
                    </td>
                    <td style={{ ...cellP, whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button type="button" onClick={() => guardarEdit(row.id)} disabled={saving === row.id}
                            style={{ padding: "4px 11px", background: "#15803D", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 800, cursor: "pointer", opacity: saving === row.id ? 0.6 : 1 }}>
                            {saving === row.id ? "…" : "✓ Guardar"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)}
                            style={{ padding: "4px 8px", background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 5 }}>
                          {!row.normalizado && (
                            <button type="button" onClick={() => aprobar(row)} disabled={saving === row.id}
                              style={{ padding: "4px 10px", background: "#F0FDF4", color: "#15803D", border: "1px solid #86EFAC", borderRadius: 5, fontSize: 11, fontWeight: 800, cursor: "pointer", opacity: saving === row.id ? 0.6 : 1 }}>
                              {saving === row.id ? "…" : "✓ Aprobar"}
                            </button>
                          )}
                          <button type="button" onClick={() => startEdit(row)}
                            style={{ padding: "4px 10px", background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "1px solid var(--erp-primary)", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {row.normalizado ? "Editar" : "Corregir"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--erp-text-3)", paddingTop: 4 }}>
        Los cambios se guardan en la columna <code style={{ fontSize: 10, background: "var(--erp-bg)", padding: "1px 5px", borderRadius: 3 }}>apellido</code> de la tabla <code style={{ fontSize: 10, background: "var(--erp-bg)", padding: "1px 5px", borderRadius: 3 }}>clientes</code>. La normalización es permanente y se registra con fecha y usuario.
      </div>
    </div>
  );
}

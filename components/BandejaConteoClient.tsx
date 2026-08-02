"use client";

import { useState, useEffect, useCallback } from "react";
import type { Conteo, ConteoItem, EstadoConteo } from "@/lib/types";
import { ESTADO_CONTEO_LABELS } from "@/lib/types";

const ESTADO_STYLE: Record<EstadoConteo, React.CSSProperties> = {
  BORRADOR: { background: "#f3f4f6", color: "#374151" },
  ENVIADO:  { background: "#fef9c3", color: "#854d0e" },
  APROBADO: { background: "#dcfce7", color: "#166534" },
  RECHAZADO:{ background: "#fee2e2", color: "#991b1b" },
};

const cell: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--erp-border)",
  fontSize: "0.875rem",
  color: "var(--erp-text)",
};

type ConteoResumen = {
  id: number;
  estado: EstadoConteo;
  nota: string | null;
  conteoUsuarioNombre: string | null;
  aprobadoPor: string | null;
  aprobadoAt: string | null;
  notaSupervisor: string | null;
  totalItems: number;
  createdAt: string;
};

export default function BandejaConteoClient() {
  const [lista, setLista] = useState<ConteoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Conteo | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [notaSupervisor, setNotaSupervisor] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editNota, setEditNota] = useState("");
  const [correcting, setCorrecting] = useState(false);

  const loadLista = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/conteo/conteos");
    if (res.ok) setLista(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadLista(); }, [loadLista]);

  const loadDetalle = useCallback(async (id: number) => {
    setDetalleLoading(true);
    const res = await fetch(`/api/conteo/conteos/${id}`);
    if (res.ok) setDetalle(await res.json());
    setDetalleLoading(false);
  }, []);

  useEffect(() => {
    if (detalleId != null) loadDetalle(detalleId);
    else setDetalle(null);
  }, [detalleId, loadDetalle]);

  async function handleAccion(accion: "APROBAR" | "RECHAZAR") {
    if (!detalleId) return;
    setProcesando(true);
    const res = await fetch(`/api/conteo/conteos/${detalleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, notaSupervisor: notaSupervisor.trim() || null }),
    });
    if (res.ok) {
      setDetalleId(null);
      setNotaSupervisor("");
      await loadLista();
    }
    setProcesando(false);
  }

  async function handleCorregir(item: ConteoItem) {
    if (!detalleId || editVal === "") return;
    setCorrecting(true);
    await fetch(`/api/conteo/conteos/${detalleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: "CORREGIR_ITEM",
        itemId: item.id,
        stockCorregido: Number(editVal),
        nota: editNota.trim() || null,
      }),
    });
    setEditItemId(null);
    setEditVal("");
    setEditNota("");
    setCorrecting(false);
    await loadDetalle(detalleId);
  }

  function formatDate(dt: string) {
    return new Date(dt).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
  }

  // ── Vista detalle ──
  if (detalleId != null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setDetalleId(null)}
            style={{ padding: "0.35rem 0.75rem", background: "transparent", border: "1px solid var(--erp-border)", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", color: "var(--erp-text-2)" }}
          >
            ← Volver
          </button>
          <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--erp-text)" }}>
            Conteo #{detalleId}
          </h3>
          {detalle && (
            <span style={{ padding: "0.2rem 0.55rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, ...ESTADO_STYLE[detalle.estado] }}>
              {ESTADO_CONTEO_LABELS[detalle.estado]}
            </span>
          )}
        </div>

        {detalleLoading && <p style={{ color: "var(--erp-text-2)", fontSize: "0.875rem" }}>Cargando…</p>}

        {detalle && (
          <>
            <div style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <span>Contador: <strong>{detalle.conteoUsuarioNombre ?? "—"}</strong></span>
              <span>Fecha: <strong>{formatDate(detalle.createdAt)}</strong></span>
              {detalle.nota && <span>Nota: <strong>{detalle.nota}</strong></span>}
            </div>

            {/* Tabla de items */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "var(--erp-surface)" }}>
                    {["Producto", "Categoría", "Sistema", "Contado", "Corregido", "Diferencia", "Nota", ""].map((h) => (
                      <th key={h} style={{ ...cell, fontWeight: 600, textAlign: h === "Sistema" || h === "Contado" || h === "Corregido" || h === "Diferencia" ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((item) => {
                    const stockFinal = item.stockCorregido ?? item.stockContado;
                    const diff = stockFinal - item.stockSistema;
                    const isEditing = editItemId === item.id;

                    return (
                      <tr key={item.id}>
                        <td style={cell}>{item.productoNombre}</td>
                        <td style={{ ...cell, color: "var(--erp-text-2)" }}>{item.categoriaNombre ?? "—"}</td>
                        <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.stockSistema}</td>
                        <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.stockContado}</td>
                        <td style={{ ...cell, textAlign: "right" }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", justifyContent: "flex-end" }}>
                              <input
                                type="number"
                                value={editVal}
                                onChange={(e) => setEditVal(e.target.value)}
                                style={{ width: "70px", padding: "0.25rem 0.4rem", border: "1px solid var(--erp-border)", borderRadius: "4px", fontSize: "0.875rem", textAlign: "right" }}
                                autoFocus
                              />
                              <input
                                type="text"
                                placeholder="Motivo"
                                value={editNota}
                                onChange={(e) => setEditNota(e.target.value)}
                                style={{ width: "90px", padding: "0.25rem 0.4rem", border: "1px solid var(--erp-border)", borderRadius: "4px", fontSize: "0.8rem" }}
                              />
                              <button type="button" onClick={() => handleCorregir(item)} disabled={correcting} style={{ padding: "0.2rem 0.5rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.775rem" }}>✓</button>
                              <button type="button" onClick={() => setEditItemId(null)} style={{ padding: "0.2rem 0.5rem", border: "1px solid var(--erp-border)", borderRadius: "4px", cursor: "pointer", fontSize: "0.775rem", background: "var(--erp-surface)", color: "var(--erp-text)" }}>✕</button>
                            </div>
                          ) : (
                            <span style={{ fontVariantNumeric: "tabular-nums", color: item.stockCorregido != null ? "#7c3aed" : "var(--erp-text-2)" }}>
                              {item.stockCorregido != null ? item.stockCorregido : "—"}
                              {item.corregidoPor && <span style={{ fontSize: "0.7rem", color: "var(--erp-text-3)", marginLeft: "0.25rem" }}>({item.corregidoPor})</span>}
                            </span>
                          )}
                        </td>
                        <td style={{ ...cell, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: diff === 0 ? "#16a34a" : diff > 0 ? "#2563eb" : "#dc2626" }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td style={{ ...cell, color: "var(--erp-text-2)", fontSize: "0.8rem" }}>{item.nota ?? "—"}</td>
                        <td style={cell}>
                          {detalle.estado === "ENVIADO" && !isEditing && (
                            <button
                              type="button"
                              onClick={() => { setEditItemId(item.id); setEditVal(String(item.stockCorregido ?? item.stockContado)); setEditNota(""); }}
                              style={{ padding: "0.2rem 0.5rem", border: "1px solid var(--erp-border)", borderRadius: "4px", cursor: "pointer", fontSize: "0.775rem", background: "var(--erp-surface)", color: "var(--erp-text)", whiteSpace: "nowrap" }}
                            >
                              ✏️ Corregir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Acciones supervisor */}
            {detalle.estado === "ENVIADO" && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", padding: "0.75rem", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px" }}>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", display: "block", marginBottom: "0.35rem" }}>
                    Nota del supervisor (opcional)
                  </label>
                  <input
                    type="text"
                    value={notaSupervisor}
                    onChange={(e) => setNotaSupervisor(e.target.value)}
                    placeholder="Observaciones…"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--erp-border)", borderRadius: "6px", fontSize: "0.875rem", background: "var(--erp-bg)", color: "var(--erp-text)", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAccion("RECHAZAR")}
                  disabled={procesando}
                  style={{ padding: "0.5rem 1rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
                >
                  ✕ Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => handleAccion("APROBAR")}
                  disabled={procesando}
                  style={{ padding: "0.5rem 1rem", background: "#dcfce7", color: "#166534", border: "1px solid #86efac", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
                >
                  ✓ Aprobar y aplicar ajustes
                </button>
              </div>
            )}

            {(detalle.estado === "APROBADO" || detalle.estado === "RECHAZADO") && (
              <div style={{ padding: "0.75rem", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px", fontSize: "0.875rem", color: "var(--erp-text-2)" }}>
                {detalle.estado === "APROBADO" ? "✅" : "✕"} {detalle.estado === "APROBADO" ? "Aprobado" : "Rechazado"} por <strong>{detalle.aprobadoPor}</strong>
                {detalle.aprobadoAt && ` · ${formatDate(detalle.aprobadoAt)}`}
                {detalle.notaSupervisor && <> · <em>{detalle.notaSupervisor}</em></>}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Vista lista ──
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--erp-text)" }}>
          Conteos recibidos
        </h3>
        <button type="button" onClick={loadLista} style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", background: "none", border: "1px solid var(--erp-border)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer" }}>
          ↻ Actualizar
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--erp-text-2)", fontSize: "0.875rem" }}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={{ color: "var(--erp-text-3)", fontSize: "0.875rem", padding: "1.5rem", textAlign: "center", borderRadius: "8px", border: "1px dashed var(--erp-border)" }}>
          No hay conteos registrados
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--erp-surface)" }}>
                {["#", "Contador", "Estado", "Items", "Fecha", ""].map((h) => (
                  <th key={h} style={{ ...cell, fontWeight: 600, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setDetalleId(c.id)}>
                  <td style={cell}>#{c.id}</td>
                  <td style={cell}>{c.conteoUsuarioNombre ?? "—"}</td>
                  <td style={cell}>
                    <span style={{ padding: "0.2rem 0.55rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, ...ESTADO_STYLE[c.estado] }}>
                      {ESTADO_CONTEO_LABELS[c.estado]}
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: "center" }}>{c.totalItems}</td>
                  <td style={{ ...cell, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{formatDate(c.createdAt)}</td>
                  <td style={cell}>
                    <span style={{ fontSize: "0.775rem", color: "var(--erp-primary)" }}>Ver →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

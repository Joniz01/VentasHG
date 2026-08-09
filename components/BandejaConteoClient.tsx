"use client";

import { useState, useEffect, useCallback } from "react";
import type { Conteo, ConteoItem, EstadoConteo } from "@/lib/types";
import { ESTADO_CONTEO_LABELS } from "@/lib/types";

const ESTADO_STYLE: Record<EstadoConteo, React.CSSProperties> = {
  BORRADOR:  { background: "#f3f4f6", color: "#374151" },
  ENVIADO:   { background: "#fef9c3", color: "#854d0e" },
  APROBADO:  { background: "#dcfce7", color: "#166534" },
  RECHAZADO: { background: "#fee2e2", color: "#991b1b" },
};

const cell: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid var(--erp-border)",
  fontSize: "0.875rem",
  color: "var(--erp-text)",
};

type FiltroEstado = "PENDIENTES" | "TODOS" | "REALIZADOS";

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
  const [eliminando, setEliminando] = useState(false);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [editNota, setEditNota] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [aprobadoId, setAprobadoId] = useState<number | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [accionError, setAccionError] = useState<string | null>(null);

  const [filtro, setFiltro] = useState<FiltroEstado>("PENDIENTES");

  // Selección para purga
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [desdeDate, setDesdeDate] = useState("");
  const [hastaDate, setHastaDate] = useState("");
  const [purgando, setPurgando] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const loadLista = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conteo/conteos");
      if (res.ok) setLista(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadLista(); }, [loadLista]);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((d) => setNombreEmpresa(d.nombre_empresa ?? ""))
      .catch(() => {});
  }, []);

  const loadDetalle = useCallback(async (id: number) => {
    setDetalleLoading(true);
    try {
      const res = await fetch(`/api/conteo/conteos/${id}`);
      if (res.ok) setDetalle(await res.json());
    } catch { /* silent */ }
    setDetalleLoading(false);
  }, []);

  useEffect(() => {
    if (detalleId != null) loadDetalle(detalleId);
    else setDetalle(null);
  }, [detalleId, loadDetalle]);

  useEffect(() => {
    setSeleccionados(new Set());
    setDesdeDate("");
    setHastaDate("");
    setPurgeError(null);
  }, [filtro]);

  // PENDIENTES = BORRADOR + ENVIADO (pendientes de acción)
  // REALIZADOS = APROBADO + RECHAZADO
  const listaFiltrada = lista.filter((c) => {
    if (filtro === "PENDIENTES") return c.estado === "BORRADOR" || c.estado === "ENVIADO";
    if (filtro === "REALIZADOS") return c.estado === "APROBADO" || c.estado === "RECHAZADO";
    return true;
  });

  const cntPendientes = lista.filter((c) => c.estado === "BORRADOR" || c.estado === "ENVIADO").length;

  async function handleAccion(accion: "APROBAR" | "RECHAZAR" | "ENVIAR") {
    if (!detalleId) return;
    setProcesando(true);
    setAccionError(null);
    const res = await fetch(`/api/conteo/conteos/${detalleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, notaSupervisor: notaSupervisor.trim() || null }),
    });
    if (res.ok) {
      if (accion === "APROBAR") setAprobadoId(detalleId);
      setDetalleId(null);
      setNotaSupervisor("");
      await loadLista();
    } else {
      const data = await res.json().catch(() => ({}));
      setAccionError(data.error ?? "Error al procesar la acción");
    }
    setProcesando(false);
  }

  async function handleEliminarDetalle() {
    if (!detalleId) return;
    if (!confirm(`¿Eliminar el conteo #${detalleId}? Esta acción es irreversible.`)) return;
    setEliminando(true);
    try {
      const res = await fetch("/api/conteo/conteos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [detalleId] }),
      });
      if (res.ok) {
        setDetalleId(null);
        await loadLista();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo eliminar");
      }
    } catch {
      alert("Error al eliminar");
    }
    setEliminando(false);
  }

  function getWhatsAppUrl() {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${base}/inventario-disponible`;
    const empresa = nombreEmpresa ? ` para *${nombreEmpresa}*` : "";
    const msg = `✅ Inventario actualizado${empresa}\n\nConsulta los productos disponibles:\n${link}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
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

  function toggleSeleccion(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (seleccionados.size === listaFiltrada.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(listaFiltrada.map((c) => c.id)));
    }
  }

  async function handlePurgar() {
    const porIds = seleccionados.size > 0;
    const porFecha = desdeDate || hastaDate;
    if (!porIds && !porFecha) return;

    const confirmMsg = porIds
      ? `¿Eliminar ${seleccionados.size} conteo(s) seleccionado(s)? Esta acción es irreversible.`
      : `¿Eliminar conteos del rango de fechas seleccionado? Esta acción es irreversible.`;
    if (!confirm(confirmMsg)) return;

    setPurgando(true);
    setPurgeError(null);
    try {
      const body = porIds
        ? { ids: [...seleccionados] }
        : { desde: desdeDate || undefined, hasta: hastaDate || undefined };

      const res = await fetch("/api/conteo/conteos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al purgar");
      setSeleccionados(new Set());
      setDesdeDate("");
      setHastaDate("");
      await loadLista();
    } catch (err) {
      setPurgeError(err instanceof Error ? err.message : "Error");
    } finally {
      setPurgando(false);
    }
  }

  function formatDate(dt: string) {
    return new Date(dt).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
  }

  // ── Vista detalle ──
  if (detalleId != null) {
    const esBorrador = detalle?.estado === "BORRADOR";
    const esEnviado  = detalle?.estado === "ENVIADO";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { setDetalleId(null); setAccionError(null); }}
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
          {/* Eliminar borrador desde detalle */}
          {esBorrador && (
            <button
              type="button"
              onClick={handleEliminarDetalle}
              disabled={eliminando}
              style={{ marginLeft: "auto", padding: "0.3rem 0.75rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
            >
              🗑️ {eliminando ? "Eliminando…" : "Eliminar borrador"}
            </button>
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

            {/* Sin items */}
            {detalle.items.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", border: "1px dashed var(--erp-border)", borderRadius: 8, color: "var(--erp-text-3)", fontSize: "0.875rem" }}>
                Este conteo está vacío — aún no se registraron productos.
                {esBorrador && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                    El contador debe ingresar a <strong>/conteo</strong> para completarlo antes de enviarlo.
                  </p>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "var(--erp-surface)" }}>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Producto</th>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Categoría</th>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>Sistema</th>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                        Físico
                        <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 400, color: "var(--erp-text-3)" }}>(total contado)</span>
                      </th>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>Corregido</th>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                        Ajuste
                        <span style={{ display: "block", fontSize: "0.68rem", fontWeight: 400, color: "var(--erp-text-3)" }}>(físico − sistema)</span>
                      </th>
                      <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Nota</th>
                      <th style={{ ...cell }}></th>
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
                          <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums", color: item.stockSistema < 0 ? "#dc2626" : "var(--erp-text)" }}>
                            {item.stockSistema}
                          </td>
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
                            {esEnviado && !isEditing && (
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
            )}

            {/* Nota aclaratoria sobre diferencia */}
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--erp-text-3)", fontStyle: "italic" }}>
              💡 "Físico" = total de unidades contadas en el depósito. "Ajuste" = cuánto debe moverse el sistema (puede ser positivo si el sistema tenía menos de lo real, incluso negativo).
            </p>

            {accionError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#dc2626" }}>{accionError}</div>
            )}

            {/* Acciones BORRADOR: enviar al supervisor */}
            {esBorrador && detalle.items.length > 0 && (
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", padding: "0.75rem", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: "8px" }}>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--erp-text-2)", flex: 1 }}>
                  Este conteo está en borrador. Una vez enviado, el supervisor podrá revisarlo y aprobarlo.
                </p>
                <button
                  type="button"
                  onClick={() => handleAccion("ENVIAR")}
                  disabled={procesando}
                  style={{ padding: "0.5rem 1.25rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
                >
                  📤 Enviar al supervisor
                </button>
              </div>
            )}

            {/* Acciones ENVIADO: aprobar/rechazar */}
            {esEnviado && (
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
                  style={{ padding: "0.5rem 1.25rem", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
                >
                  ✕ Rechazar (recontar)
                </button>
                <button
                  type="button"
                  onClick={() => handleAccion("APROBAR")}
                  disabled={procesando}
                  style={{ padding: "0.5rem 1.25rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}
                >
                  ✓ Aprobar y ajustar stock
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

  // ── Banner WhatsApp post-aprobación ──
  if (aprobadoId !== null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: "1.25rem", textAlign: "center", padding: "2rem" }}>
        <span style={{ fontSize: "3rem" }}>✅</span>
        <div>
          <h3 style={{ margin: "0 0 0.35rem 0", fontSize: "1.1rem", fontWeight: 800, color: "var(--erp-text)" }}>
            ¡Inventario actualizado!
          </h3>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--erp-text-2)" }}>
            El conteo #{aprobadoId} fue aprobado y el stock fue ajustado.
          </p>
        </div>
        <a
          href={getWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.6rem",
            background: "#25D366", color: "#fff",
            padding: "0.65rem 1.5rem", borderRadius: 10,
            fontWeight: 700, fontSize: "0.95rem", textDecoration: "none",
            boxShadow: "0 2px 8px rgba(37,211,102,0.35)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Enviar por WhatsApp
        </a>
        <a
          href="/inventario-disponible"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.8rem", color: "var(--erp-primary)", textDecoration: "underline" }}
        >
          Ver inventario disponible →
        </a>
        <button
          type="button"
          onClick={() => setAprobadoId(null)}
          style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.8rem", color: "var(--erp-text-2)", cursor: "pointer" }}
        >
          Volver a la bandeja
        </button>
      </div>
    );
  }

  // ── Vista lista ──
  const todosSeleccionados = listaFiltrada.length > 0 && seleccionados.size === listaFiltrada.length;
  const haySeleccion = seleccionados.size > 0 || desdeDate || hastaDate;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--erp-text)" }}>
          📋 Bandeja de Conteos de Inventario
        </h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => { setModoSeleccion((v) => !v); setSeleccionados(new Set()); setDesdeDate(""); setHastaDate(""); setPurgeError(null); }}
            style={{ fontSize: "0.8rem", color: modoSeleccion ? "#dc2626" : "var(--erp-text-2)", background: modoSeleccion ? "#fee2e2" : "none", border: `1px solid ${modoSeleccion ? "#fca5a5" : "var(--erp-border)"}`, borderRadius: "6px", padding: "0.3rem 0.7rem", cursor: "pointer" }}
          >
            {modoSeleccion ? "✕ Cancelar" : "🗑️ Purgar"}
          </button>
          <button
            type="button"
            onClick={loadLista}
            style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", background: "none", border: "1px solid var(--erp-border)", borderRadius: "6px", padding: "0.3rem 0.6rem", cursor: "pointer" }}
          >
            ↻ Actualizar
          </button>
        </div>
      </div>

      {/* Filtros de estado */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--erp-border)", paddingBottom: "0.5rem" }}>
        {(["PENDIENTES", "TODOS", "REALIZADOS"] as FiltroEstado[]).map((f) => {
          const labels: Record<FiltroEstado, string> = {
            PENDIENTES: `⏳ Pendientes${cntPendientes > 0 ? ` (${cntPendientes})` : ""}`,
            TODOS: `📋 Todos (${lista.length})`,
            REALIZADOS: "✅ Realizados",
          };
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              style={{
                padding: "0.3rem 0.85rem",
                fontSize: "0.8rem",
                fontWeight: filtro === f ? 700 : 400,
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: filtro === f ? "var(--erp-primary)" : "transparent",
                color: filtro === f ? "#fff" : "var(--erp-text-2)",
              }}
            >
              {labels[f]}
            </button>
          );
        })}
      </div>

      {/* Panel purga por rango de fechas */}
      {modoSeleccion && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "#7c2d12" }}>
            🗑️ Modo purga — Selecciona filas en la tabla o elige un rango de fechas
          </p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9a3412" }}>Desde</label>
              <input
                type="date"
                value={desdeDate}
                onChange={(e) => { setDesdeDate(e.target.value); setSeleccionados(new Set()); }}
                style={{ border: "1px solid #fdba74", borderRadius: "5px", padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9a3412" }}>Hasta</label>
              <input
                type="date"
                value={hastaDate}
                onChange={(e) => { setHastaDate(e.target.value); setSeleccionados(new Set()); }}
                style={{ border: "1px solid #fdba74", borderRadius: "5px", padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}
              />
            </div>
            <button
              type="button"
              onClick={handlePurgar}
              disabled={purgando || !haySeleccion}
              style={{
                background: haySeleccion ? "#dc2626" : "#e5e7eb",
                color: haySeleccion ? "#fff" : "#9ca3af",
                border: "none",
                borderRadius: "6px",
                padding: "0.4rem 1rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: haySeleccion ? "pointer" : "not-allowed",
              }}
            >
              {purgando ? "Eliminando…" : seleccionados.size > 0 ? `Eliminar ${seleccionados.size} seleccionado(s)` : "Eliminar por rango"}
            </button>
          </div>
          {purgeError && (
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#dc2626" }}>{purgeError}</p>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--erp-text-2)", fontSize: "0.875rem" }}>Cargando…</p>
      ) : listaFiltrada.length === 0 ? (
        <p style={{ color: "var(--erp-text-3)", fontSize: "0.875rem", padding: "1.5rem", textAlign: "center", borderRadius: "8px", border: "1px dashed var(--erp-border)" }}>
          {filtro === "PENDIENTES" ? "No hay conteos pendientes 🎉" : "No hay conteos registrados"}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "var(--erp-surface)" }}>
                {modoSeleccion && (
                  <th style={{ ...cell, width: 36 }}>
                    <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} style={{ cursor: "pointer" }} />
                  </th>
                )}
                <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>#</th>
                <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Contador</th>
                <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Estado</th>
                <th style={{ ...cell, fontWeight: 600, textAlign: "center" }}>Items</th>
                <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Fecha</th>
                <th style={{ ...cell, fontWeight: 600, textAlign: "left" }}>Aprobado por</th>
                <th style={{ ...cell }}></th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    cursor: modoSeleccion ? "default" : "pointer",
                    background: seleccionados.has(c.id) ? "#fef3c7" : undefined,
                  }}
                  onClick={() => modoSeleccion ? toggleSeleccion(c.id) : setDetalleId(c.id)}
                >
                  {modoSeleccion && (
                    <td style={{ ...cell, width: 36 }} onClick={(e) => { e.stopPropagation(); toggleSeleccion(c.id); }}>
                      <input type="checkbox" checked={seleccionados.has(c.id)} onChange={() => toggleSeleccion(c.id)} style={{ cursor: "pointer" }} />
                    </td>
                  )}
                  <td style={cell}>#{c.id}</td>
                  <td style={cell}>{c.conteoUsuarioNombre ?? "—"}</td>
                  <td style={cell}>
                    <span style={{ padding: "0.2rem 0.55rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 600, ...ESTADO_STYLE[c.estado] }}>
                      {ESTADO_CONTEO_LABELS[c.estado]}
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: "center" }}>{c.totalItems}</td>
                  <td style={{ ...cell, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{formatDate(c.createdAt)}</td>
                  <td style={{ ...cell, color: "var(--erp-text-2)" }}>{c.aprobadoPor ?? "—"}</td>
                  <td style={cell}>
                    {!modoSeleccion && (
                      <span style={{ fontSize: "0.775rem", color: c.estado === "BORRADOR" ? "var(--erp-text-3)" : "var(--erp-primary)" }}>
                        {c.estado === "BORRADOR" ? "Ver →" : "Revisar →"}
                      </span>
                    )}
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

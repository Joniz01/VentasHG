"use client";

import { useState, useEffect, useCallback } from "react";

const fmtNum = (n: number, dec = 4) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: dec });

const fmtFecha = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

type OrdenRow = {
  id: number; producto_id: number; producto_nombre: string; unidad_medida: string;
  estado: "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";
  cantidad_planificada: number; cantidad_producida: number;
  fecha_planificada: string | null; fecha_inicio: string | null; fecha_fin: string | null;
  notas: string | null; created_at: string;
};

type Consumo = {
  id: number; insumoId: number; insumoNombre: string; unidadMedida: string;
  cantidadPlanificada: number; cantidadConsumida: number; stockActual: number; deficit: number; ok: boolean;
};

type Detalle = {
  orden: {
    id: number; productoId: number; productoNombre: string; unidadMedida: string; productoStock: number;
    estado: string; cantidadPlanificada: number; cantidadProducida: number;
    fechaPlanificada: string | null; fechaInicio: string | null; fechaFin: string | null;
    notas: string | null; createdAt: string;
  };
  consumos: Consumo[];
};

type ProductoBom = { id: number; nombre: string; subtipo_fabricacion: string | null; categoria_nombre: string | null; rendimiento: number; total_insumos: number };

const ESTADO_CFG = {
  PENDIENTE:   { label: "Pendiente",   bg: "rgba(217,119,6,0.12)",   color: "#B45309", icon: "⏳" },
  EN_PROCESO:  { label: "En Proceso",  bg: "rgba(37,99,235,0.12)",   color: "#1D4ED8", icon: "⚙️" },
  COMPLETADA:  { label: "Completada",  bg: "rgba(5,150,105,0.12)",   color: "#059669", icon: "✅" },
  CANCELADA:   { label: "Cancelada",   bg: "rgba(185,28,28,0.12)",   color: "#B91C1C", icon: "✕"  },
};

const S: React.CSSProperties = {
  border: "1px solid var(--erp-border)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", width: "100%",
};
const lbl: React.CSSProperties = {
  fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block",
  fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CFG[estado as keyof typeof ESTADO_CFG] ?? { label: estado, bg: "#eee", color: "#666", icon: "" };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export default function OrdenesProduccionClient() {
  const today = new Date().toISOString().slice(0, 10);
  const [ordenes, setOrdenes] = useState<OrdenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<string>("TODAS");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Detail modal
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [accionError, setAccionError] = useState<string | null>(null);

  // New order form
  const [showNueva, setShowNueva] = useState(false);
  const [productos, setProductos] = useState<ProductoBom[]>([]);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [fechaPlan, setFechaPlan] = useState(today);
  const [notas, setNotas] = useState("");
  const [simulacion, setSimulacion] = useState<{ puedeProducir: boolean; maxProducible: number; necesidades: { insumoId: number; nombre: string; unidadMedida: string; necesario: number; disponible: number; deficit: number; ok: boolean }[] } | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadOrdenes = useCallback(async (estado?: string) => {
    setLoading(true); setError(null);
    const ef = estado ?? estadoFiltro;
    try {
      const params = new URLSearchParams();
      if (ef !== "TODAS") params.set("estado", ef);
      const res = await fetch(`/api/produccion?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrdenes(data.items ?? []);
      setPage(1);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }, [estadoFiltro]);

  useEffect(() => { loadOrdenes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showNueva) return;
    fetch("/api/productos/bom").then(r => r.json()).then(d => setProductos(d.productos ?? [])).catch(() => {});
  }, [showNueva]);

  async function simular(pid: number, cant: number) {
    if (!pid || cant <= 0) { setSimulacion(null); return; }
    setSimLoading(true);
    try {
      const res = await fetch("/api/productos/bom/simular", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: pid, cantidad: cant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSimulacion(data);
    } catch { setSimulacion(null); }
    finally { setSimLoading(false); }
  }

  function handleProductoChange(pid: number) {
    setProductoId(pid);
    const cant = parseFloat(cantidad);
    if (pid && cant > 0) simular(pid, cant);
    else setSimulacion(null);
  }

  function handleCantidadBlur() {
    const cant = parseFloat(cantidad);
    if (productoId && cant > 0) simular(productoId, cant);
    else setSimulacion(null);
  }

  async function handleCrear() {
    if (!productoId || !cantidad || parseFloat(cantidad) <= 0) { setSaveError("Selecciona producto y cantidad"); return; }
    setSaving(true); setSaveError(null);
    try {
      const res = await fetch("/api/produccion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId, cantidadPlanificada: parseFloat(cantidad), fechaPlanificada: fechaPlan || null, notas: notas.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNueva(false);
      setProductoId(null); setCantidad(""); setNotas(""); setSimulacion(null);
      loadOrdenes();
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Error al crear"); }
    finally { setSaving(false); }
  }

  async function loadDetalle(id: number) {
    setDetalleLoading(true); setAccionError(null);
    try {
      const res = await fetch(`/api/produccion/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetalle(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setDetalleLoading(false); }
  }

  async function handleAccion(accion: "iniciar" | "completar" | "cancelar") {
    if (!detalle) return;
    if (accion === "completar" && !confirm("¿Confirmar producción? Se descontarán los insumos del inventario y se agregará el producto terminado.")) return;
    if (accion === "cancelar" && !confirm("¿Cancelar esta orden de producción?")) return;
    setAccionando(true); setAccionError(null);
    try {
      const res = await fetch(`/api/produccion/${detalle.orden.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadDetalle(detalle.orden.id);
      loadOrdenes();
    } catch (err) { setAccionError(err instanceof Error ? err.message : "Error"); }
    finally { setAccionando(false); }
  }

  // KPIs
  const kpiPendiente  = ordenes.filter(o => o.estado === "PENDIENTE").length;
  const kpiEnProceso  = ordenes.filter(o => o.estado === "EN_PROCESO").length;
  const kpiCompletada = ordenes.filter(o => o.estado === "COMPLETADA" && o.fecha_fin?.slice(0, 10) === today).length;

  const paginadas = ordenes.slice((page - 1) * pageSize, page * pageSize);

  // ── NUEVA ORDEN FORM ────────────────────────────────────────────────────────
  if (showNueva) {
    const selectedProd = productos.find(p => p.id === productoId);
    return (
      <div style={{ maxWidth: 860, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button type="button" onClick={() => setShowNueva(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-2)", fontSize: 13 }}>← Volver</button>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-text)", margin: 0 }}>Nueva Orden de Producción</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Producto */}
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--erp-text-3)", marginBottom: 12, letterSpacing: "0.06em" }}>① Producto a fabricar</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Producto</label>
                <select style={S} value={productoId ?? ""} onChange={e => handleProductoChange(Number(e.target.value) || 0)}>
                  <option value="">— Seleccionar —</option>
                  {productos.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}{p.subtipo_fabricacion ? ` (${p.subtipo_fabricacion})` : ""}</option>
                  ))}
                </select>
                {selectedProd && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "var(--erp-text-3)" }}>
                    {selectedProd.categoria_nombre ?? "—"} · Rendimiento: {selectedProd.rendimiento} · {selectedProd.total_insumos} insumo{selectedProd.total_insumos !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Cantidad a producir</label>
                <input type="number" min="0.001" step="0.001" value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  onBlur={handleCantidadBlur}
                  placeholder="0" style={S} />
              </div>
              <div>
                <label style={lbl}>Fecha planificada</label>
                <input type="date" value={fechaPlan} onChange={e => setFechaPlan(e.target.value)} style={S} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Notas</label>
              <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Opcional" style={S} />
            </div>
          </div>

          {/* Simulación BOM */}
          {(simLoading || simulacion) && (
            <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--erp-text-3)", marginBottom: 12, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 10 }}>
                <span>② Insumos requeridos</span>
                {simLoading && <span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 400 }}>Calculando...</span>}
                {simulacion && !simLoading && (
                  <span style={{ fontWeight: 700, color: simulacion.puedeProducir ? "#059669" : "#B91C1C" }}>
                    {simulacion.puedeProducir ? "✅ Stock suficiente" : "⚠ Stock insuficiente"}
                  </span>
                )}
              </div>
              {simulacion && !simLoading && (
                <>
                  {simulacion.necesidades.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--erp-text-3)" }}>No se encontraron insumos en la receta.</div>
                  )}
                  {simulacion.necesidades.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--erp-bg)" }}>
                            {["Insumo", "Necesario", "Disponible", "Déficit", "Estado"].map(h => (
                              <th key={h} style={{ padding: "7px 10px", textAlign: h === "Estado" ? "center" : h === "Insumo" ? "left" : "right", color: "var(--erp-text-2)", fontWeight: 600, fontSize: 11, borderBottom: "1px solid var(--erp-border)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {simulacion.necesidades.map((n) => (
                            <tr key={n.insumoId} style={{ borderBottom: "1px solid var(--erp-border)" }}>
                              <td style={{ padding: "7px 10px", color: "var(--erp-text)" }}>{n.nombre}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(n.necesario)} {n.unidadMedida}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--erp-text-2)" }}>{fmtNum(n.disponible)}</td>
                              <td style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: n.deficit > 0 ? "#B91C1C" : "var(--erp-text-3)" }}>
                                {n.deficit > 0 ? `-${fmtNum(n.deficit)}` : "—"}
                              </td>
                              <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                <span style={{ background: n.ok ? "rgba(5,150,105,0.12)" : "rgba(185,28,28,0.12)", color: n.ok ? "#059669" : "#B91C1C", borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                                  {n.ok ? "OK" : "DÉFICIT"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!simulacion.puedeProducir && simulacion.maxProducible > 0 && (
                        <div style={{ marginTop: 10, fontSize: 12, color: "#B45309", padding: "8px 12px", background: "rgba(217,119,6,0.08)", borderRadius: 8 }}>
                          Con el stock actual se pueden producir hasta <strong>{fmtNum(simulacion.maxProducible)}</strong> unidades.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {saveError && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{saveError}</div>}

          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button type="button" onClick={() => setShowNueva(false)}
              style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", color: "var(--erp-text-2)" }}>
              Cancelar
            </button>
            <button type="button" onClick={handleCrear} disabled={saving || !productoId || !cantidad}
              style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 700, cursor: (saving || !productoId || !cantidad) ? "not-allowed" : "pointer", opacity: (saving || !productoId || !cantidad) ? 0.5 : 1 }}>
              {saving ? "Creando..." : "📋 Crear Orden"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4" style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--erp-text)", margin: 0 }}>Órdenes de Producción</h2>
        <button type="button" onClick={() => setShowNueva(true)}
          style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nueva Orden
        </button>
      </div>

      {/* KPI tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "Pendientes", value: kpiPendiente, color: "#B45309", bg: "rgba(217,119,6,0.08)" },
          { label: "En Proceso", value: kpiEnProceso, color: "#1D4ED8", bg: "rgba(37,99,235,0.08)" },
          { label: "Completadas hoy", value: kpiCompletada, color: "#059669", bg: "rgba(5,150,105,0.08)" },
          { label: "Total (lista)", value: ordenes.length, color: "var(--erp-text)", bg: "var(--erp-surface)" },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, border: "1px solid var(--erp-border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--erp-text-2)", marginBottom: 6, letterSpacing: "0.05em" }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase" }}>Estado:</span>
        <div style={{ display: "flex", border: "1px solid var(--erp-border)", borderRadius: 8, overflow: "hidden" }}>
          {(["TODAS", "PENDIENTE", "EN_PROCESO", "COMPLETADA", "CANCELADA"] as const).map((op, i, arr) => (
            <button key={op} type="button" onClick={() => { setEstadoFiltro(op); loadOrdenes(op); }}
              style={{ background: estadoFiltro === op ? "var(--erp-primary)" : "var(--erp-bg)", color: estadoFiltro === op ? "#fff" : "var(--erp-text-2)", border: "none", borderRight: i < arr.length - 1 ? "1px solid var(--erp-border)" : "none", padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              {op === "TODAS" ? "Todas" : op === "EN_PROCESO" ? "En Proceso" : op.charAt(0) + op.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => loadOrdenes()} disabled={loading}
          style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "..." : "Actualizar"}
        </button>
      </div>

      {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{error}</div>}

      {/* Tabla */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["#", "Producto", "Cantidad", "Planificada", "Estado", "Creada", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: h === "Cantidad" ? "right" : h === "Estado" ? "center" : "left", color: "var(--erp-text-2)", fontWeight: 600, borderBottom: "1px solid var(--erp-border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</td></tr>}
              {!loading && paginadas.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>No hay órdenes{estadoFiltro !== "TODAS" ? ` con estado ${estadoFiltro}` : ""}</td></tr>}
              {!loading && paginadas.map((o, idx, arr) => (
                <tr key={o.id} style={{ borderBottom: idx < arr.length - 1 ? "1px solid var(--erp-border)" : "none", opacity: o.estado === "CANCELADA" ? 0.5 : 1 }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--erp-primary)" }}>#{o.id}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--erp-text)" }}>{o.producto_nombre}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                    {fmtNum(Number(o.cantidad_planificada))} <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{o.unidad_medida}</span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{fmtFecha(o.fecha_planificada)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}><EstadoBadge estado={o.estado} /></td>
                  <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap", fontSize: 12 }}>{fmtFecha(o.created_at)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <button type="button" onClick={() => loadDetalle(o.id)}
                      style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--erp-text-2)" }}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {ordenes.length > pageSize && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, fontSize: 13 }}>
          <span style={{ color: "var(--erp-text-2)" }}>{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, ordenes.length)} de {ordenes.length}</span>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>‹</button>
          <button type="button" onClick={() => setPage(p => Math.min(Math.ceil(ordenes.length / pageSize), p + 1))} disabled={page >= Math.ceil(ordenes.length / pageSize)}
            style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: page >= Math.ceil(ordenes.length / pageSize) ? "default" : "pointer", opacity: page >= Math.ceil(ordenes.length / pageSize) ? 0.4 : 1 }}>›</button>
        </div>
      )}

      {/* Detail modal */}
      {(detalle || detalleLoading) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }}
          onClick={() => { if (!accionando) setDetalle(null); }}>
          <div style={{ background: "var(--erp-surface)", borderRadius: 16, width: "100%", maxWidth: 620, marginTop: 40 }} onClick={e => e.stopPropagation()}>
            {detalleLoading && <div style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</div>}
            {detalle && !detalleLoading && (() => {
              const { orden, consumos } = detalle;
              const puedeIniciar = orden.estado === "PENDIENTE";
              const puedeCompletar = orden.estado === "PENDIENTE" || orden.estado === "EN_PROCESO";
              const puedeCancelar = orden.estado !== "COMPLETADA" && orden.estado !== "CANCELADA";
              const todosOk = consumos.every(c => c.ok);
              return (
                <>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--erp-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--erp-text)" }}>OP #{orden.id} — {orden.productoNombre}</span>
                        <EstadoBadge estado={orden.estado} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--erp-text-3)", marginTop: 3 }}>
                        {fmtNum(orden.cantidadPlanificada)} {orden.unidadMedida} · Creada {fmtFecha(orden.createdAt)}
                        {orden.fechaPlanificada && ` · Plan: ${fmtFecha(orden.fechaPlanificada)}`}
                      </div>
                    </div>
                    <button type="button" onClick={() => setDetalle(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)", fontSize: 20 }}>✕</button>
                  </div>

                  <div style={{ padding: 20 }}>
                    {/* Stock del producto */}
                    <div style={{ marginBottom: 14, background: "var(--erp-bg)", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 24, flexWrap: "wrap" }}>
                      <div><span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Stock actual producto</span><div style={{ fontWeight: 700, color: "var(--erp-text)" }}>{fmtNum(orden.productoStock)} {orden.unidadMedida}</div></div>
                      {orden.estado === "COMPLETADA" && <div><span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Producido</span><div style={{ fontWeight: 700, color: "#059669" }}>{fmtNum(orden.cantidadProducida)} {orden.unidadMedida}</div></div>}
                      {orden.fechaInicio && <div><span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Inicio</span><div style={{ fontWeight: 600, color: "var(--erp-text-2)", fontSize: 12 }}>{new Date(orden.fechaInicio).toLocaleString("es-VE")}</div></div>}
                      {orden.fechaFin && <div><span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Fin</span><div style={{ fontWeight: 600, color: "var(--erp-text-2)", fontSize: 12 }}>{new Date(orden.fechaFin).toLocaleString("es-VE")}</div></div>}
                    </div>

                    {orden.notas && <div style={{ marginBottom: 12, fontSize: 13, color: "var(--erp-text-2)", fontStyle: "italic" }}>"{orden.notas}"</div>}

                    {/* Consumos */}
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--erp-text-3)", marginBottom: 8, letterSpacing: "0.06em" }}>
                      Insumos requeridos
                      {puedeCompletar && (
                        <span style={{ marginLeft: 8, fontWeight: 700, color: todosOk ? "#059669" : "#B91C1C" }}>
                          {todosOk ? "✅ Stock suficiente" : "⚠ Stock insuficiente"}
                        </span>
                      )}
                    </div>
                    {consumos.length === 0 && <div style={{ fontSize: 13, color: "var(--erp-text-3)" }}>Sin insumos registrados.</div>}
                    {consumos.length > 0 && (
                      <div style={{ overflowX: "auto", marginBottom: 16 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "var(--erp-bg)" }}>
                              {["Insumo", "Planif.", "Consumido", "Stock", ""].map(h => (
                                <th key={h} style={{ padding: "6px 8px", textAlign: h === "Insumo" || h === "" ? "left" : "right", color: "var(--erp-text-2)", fontWeight: 600, fontSize: 10, borderBottom: "1px solid var(--erp-border)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {consumos.map(c => (
                              <tr key={c.id} style={{ borderBottom: "1px solid var(--erp-border)" }}>
                                <td style={{ padding: "6px 8px", color: "var(--erp-text)" }}>{c.insumoNombre}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(c.cantidadPlanificada)} {c.unidadMedida}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--erp-text-2)" }}>
                                  {c.cantidadConsumida > 0 ? fmtNum(c.cantidadConsumida) : "—"}
                                </td>
                                <td style={{ padding: "6px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.ok ? "var(--erp-text-2)" : "#B91C1C", fontWeight: c.ok ? 400 : 700 }}>
                                  {fmtNum(c.stockActual)}
                                  {!c.ok && <span style={{ marginLeft: 4 }}>(-{fmtNum(c.deficit)})</span>}
                                </td>
                                <td style={{ padding: "6px 8px" }}>
                                  <span style={{ background: c.ok ? "rgba(5,150,105,0.12)" : "rgba(185,28,28,0.12)", color: c.ok ? "#059669" : "#B91C1C", borderRadius: 99, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                                    {c.ok ? "OK" : "↓"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {accionError && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 12 }}>{accionError}</div>}

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {puedeIniciar && (
                        <button type="button" onClick={() => handleAccion("iniciar")} disabled={accionando}
                          style={{ background: "rgba(37,99,235,0.10)", color: "#1D4ED8", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          {accionando ? "..." : "⚙️ Iniciar"}
                        </button>
                      )}
                      {puedeCompletar && (
                        <button type="button" onClick={() => handleAccion("completar")} disabled={accionando}
                          style={{ background: "rgba(5,150,105,0.10)", color: "#059669", border: "1px solid rgba(5,150,105,0.3)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          {accionando ? "..." : "✅ Completar (consume insumos)"}
                        </button>
                      )}
                      {puedeCancelar && (
                        <button type="button" onClick={() => handleAccion("cancelar")} disabled={accionando}
                          style={{ background: "rgba(185,28,28,0.08)", color: "#B91C1C", border: "1px solid rgba(185,28,28,0.25)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          {accionando ? "..." : "Cancelar"}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

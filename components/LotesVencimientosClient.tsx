"use client";

import { useState, useEffect, useCallback } from "react";
import InputFecha from "@/components/InputFecha";

type Lote = {
  id: number;
  productoId: number;
  productoNombre: string;
  unidadMedida: string;
  categoriaNombre: string | null;
  numeroLote: string;
  fechaEntrada: string;
  fechaVencimiento: string | null;
  cantidadInicial: number;
  cantidadActual: number;
  diasParaVencer: number | null;
  diasAlerta: number;
  createdAt: string;
};

type Producto = {
  id: number;
  nombre: string;
  stockActual: number;
  unidadMedida: string;
  categoriaNombre: string | null;
};

type Tab = "activos" | "registrar" | "historial";

function estadoLote(lote: Lote): "vencido" | "proximo" | "ok" | "sin_fecha" {
  if (lote.diasParaVencer === null) return "sin_fecha";
  if (lote.diasParaVencer < 0) return "vencido";
  if (lote.diasParaVencer <= lote.diasAlerta) return "proximo";
  return "ok";
}

const ESTADO_COLOR: Record<string, string> = {
  vencido:  "#b91c1c",
  proximo:  "#B45309",
  ok:       "#15803d",
  sin_fecha: "var(--erp-text-3)",
};
const ESTADO_BG: Record<string, string> = {
  vencido:  "#fef2f2",
  proximo:  "#fffbeb",
  ok:       "#f0fdf4",
  sin_fecha: "var(--erp-surface-2)",
};
const ESTADO_LABEL: Record<string, string> = {
  vencido:  "Vencido",
  proximo:  "Por vencer",
  ok:       "Vigente",
  sin_fecha: "Sin fecha",
};
const ESTADO_ICON: Record<string, string> = {
  vencido: "🔴", proximo: "🟡", ok: "🟢", sin_fecha: "⚪",
};

function formatFecha(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const today = new Date().toISOString().slice(0, 10);

const emptyForm = {
  productoId: "",
  numeroLote: "",
  fechaEntrada: today,
  fechaVencimiento: "",
  cantidad: "",
};

export default function LotesVencimientosClient() {
  const [tab, setTab] = useState<Tab>("activos");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [historial, setHistorial] = useState<Lote[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const fetchLotes = useCallback(() => {
    setLoading(true);
    fetch("/api/inventario/lotes")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setLotes(Array.isArray(d) ? d : []))
      .catch(() => setLotes([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchProductos = useCallback(() => {
    fetch("/api/inventario/ajustes")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setProductos(Array.isArray(d) ? d : []))
      .catch(() => setProductos([]));
  }, []);

  useEffect(() => {
    fetchLotes();
    fetchProductos();
  }, [fetchLotes, fetchProductos]);

  function fetchHistorial() {
    setLoadingHist(true);
    fetch("/api/inventario/lotes?vencidos=1&inactivos=1")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setHistorial(Array.isArray(d) ? d : []))
      .catch(() => setHistorial([]))
      .finally(() => setLoadingHist(false));
  }

  async function cerrarLote(id: number) {
    await fetch(`/api/inventario/lotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false }),
    });
    fetchLotes();
  }

  async function guardar() {
    setFormError(null);
    const cantNum = parseFloat(form.cantidad.replace(",", "."));
    if (!form.productoId) return setFormError("Selecciona un producto");
    if (!form.numeroLote.trim()) return setFormError("Número de lote requerido");
    if (Number.isNaN(cantNum) || cantNum <= 0) return setFormError("Cantidad debe ser mayor a 0");

    setSaving(true);
    try {
      const res = await fetch("/api/inventario/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: Number(form.productoId),
          numeroLote: form.numeroLote,
          fechaEntrada: form.fechaEntrada,
          fechaVencimiento: form.fechaVencimiento || null,
          cantidad: cantNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      setFormOk(true);
      setForm(emptyForm);
      fetchLotes();
      setTimeout(() => { setFormOk(false); setTab("activos"); }, 1800);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // Filtrar lotes
  const lotesFiltrados = lotes.filter((l) => {
    const matchBusqueda = !busqueda.trim() ||
      l.productoNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      l.numeroLote.toLowerCase().includes(busqueda.toLowerCase());
    const estado = estadoLote(l);
    const matchEstado = filtroEstado === "todos" || estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const alertaCount = lotes.filter((l) => {
    const e = estadoLote(l);
    return e === "vencido" || e === "proximo";
  }).length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem", fontSize: "0.8rem", fontWeight: 600,
    border: "none", borderBottom: active ? "2px solid #1D4ED8" : "2px solid transparent",
    background: "none", color: active ? "#1D4ED8" : "var(--erp-text-3)",
    cursor: "pointer", whiteSpace: "nowrap",
  });

  const badge = (n: number, color: string) => (
    <span style={{
      marginLeft: 5, background: color, color: "#fff",
      borderRadius: 10, padding: "0.05rem 0.45rem",
      fontSize: "0.68rem", fontWeight: 700,
    }}>{n}</span>
  );

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--erp-text-1)" }}>
          🏷️ Lotes & Vencimientos
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--erp-text-3)" }}>
          Control de trazabilidad, FIFO y fechas de caducidad
        </p>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {[
          { label: "Lotes activos", value: lotes.length, color: "#1D4ED8", bg: "#eff6ff" },
          { label: "Por vencer / Vencidos", value: alertaCount, color: alertaCount > 0 ? "#b91c1c" : "#15803d", bg: alertaCount > 0 ? "#fef2f2" : "#f0fdf4" },
        ].map((k) => (
          <div key={k.label} style={{
            background: k.bg, borderRadius: 10, padding: "0.5rem 0.9rem",
            display: "flex", flexDirection: "column", gap: 1, minWidth: 130,
          }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: k.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Pestañas */}
      <div style={{ borderBottom: "1px solid var(--erp-border)", display: "flex", gap: 0 }}>
        <button style={tabStyle(tab === "activos")} onClick={() => setTab("activos")}>
          📦 Lotes activos {alertaCount > 0 && badge(alertaCount, "#b91c1c")}
        </button>
        <button style={tabStyle(tab === "registrar")} onClick={() => setTab("registrar")}>
          ➕ Registrar lote
        </button>
        <button style={tabStyle(tab === "historial")} onClick={() => { setTab("historial"); fetchHistorial(); }}>
          🕓 Historial
        </button>
      </div>

      {/* ── TAB: Activos ── */}
      {tab === "activos" && (
        <>
          {/* Filtros */}
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <input
                type="text" placeholder="Buscar producto o lote…" value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  width: "100%", padding: "0.5rem 0.8rem", fontSize: "0.875rem",
                  border: "1px solid var(--erp-border)", borderRadius: 8,
                  background: "var(--erp-surface-1)", color: "var(--erp-text-1)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              {busqueda && (
                <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)" }}>✕</button>
              )}
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem", borderRadius: 8,
                border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)",
                color: "var(--erp-text-1)", fontSize: "0.8rem",
              }}
            >
              <option value="todos">Todos los estados</option>
              <option value="vencido">🔴 Vencidos</option>
              <option value="proximo">🟡 Por vencer</option>
              <option value="ok">🟢 Vigentes</option>
              <option value="sin_fecha">⚪ Sin fecha</option>
            </select>
          </div>

          <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Cargando lotes…</div>
            ) : lotesFiltrados.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
                {lotes.length === 0 ? "No hay lotes registrados aún. Usa Registrar lote para comenzar." : "Sin resultados para el filtro actual."}
              </div>
            ) : (
              <>
                {/* Header tabla */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 100px 100px 110px 90px 80px",
                  padding: "0.35rem 0.9rem", background: "var(--erp-surface-2)",
                  borderBottom: "1px solid var(--erp-border)",
                  fontSize: "0.68rem", fontWeight: 700, color: "var(--erp-text-3)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  <span>Producto / Lote</span>
                  <span style={{ textAlign: "right" }}>Cantidad</span>
                  <span style={{ textAlign: "center" }}>Entrada</span>
                  <span style={{ textAlign: "center" }}>Vencimiento</span>
                  <span style={{ textAlign: "center" }}>Estado</span>
                  <span />
                </div>
                {lotesFiltrados.map((lote, idx) => {
                  const estado = estadoLote(lote);
                  return (
                    <div
                      key={lote.id}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 100px 100px 110px 90px 80px",
                        alignItems: "center", gap: "0.5rem",
                        padding: "0.55rem 0.9rem",
                        borderBottom: idx < lotesFiltrados.length - 1 ? "1px solid var(--erp-border)" : "none",
                        background: estado === "vencido" ? "#fff5f5" : "var(--erp-surface-1)",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--erp-text-1)" }}>{lote.productoNombre}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--erp-text-3)" }}>Lote: {lote.numeroLote}</div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "0.8rem", fontWeight: 700, color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>
                        {lote.cantidadActual} <span style={{ fontWeight: 400, fontSize: "0.72rem" }}>{lote.unidadMedida}</span>
                      </div>
                      <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--erp-text-3)" }}>
                        {formatFecha(lote.fechaEntrada)}
                      </div>
                      <div style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: 600, color: ESTADO_COLOR[estado] }}>
                        {lote.fechaVencimiento ? (
                          <>
                            {formatFecha(lote.fechaVencimiento)}
                            {lote.diasParaVencer !== null && (
                              <div style={{ fontSize: "0.68rem", fontWeight: 400 }}>
                                {lote.diasParaVencer < 0
                                  ? `Venció hace ${Math.abs(lote.diasParaVencer)}d`
                                  : lote.diasParaVencer === 0
                                  ? "Vence hoy"
                                  : `${lote.diasParaVencer}d restantes`}
                              </div>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--erp-text-3)", fontWeight: 400 }}>—</span>
                        )}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem",
                          borderRadius: 5, background: ESTADO_BG[estado], color: ESTADO_COLOR[estado],
                        }}>
                          {ESTADO_ICON[estado]} {ESTADO_LABEL[estado]}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <button
                          onClick={() => cerrarLote(lote.id)}
                          style={{
                            fontSize: "0.7rem", padding: "0.25rem 0.5rem",
                            borderRadius: 5, border: "1px solid var(--erp-border)",
                            background: "none", color: "var(--erp-text-3)",
                            cursor: "pointer",
                          }}
                          title="Cerrar lote"
                        >Cerrar</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}

      {/* ── TAB: Registrar ── */}
      {tab === "registrar" && (
        <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {formOk && (
            <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: "0.875rem", fontWeight: 600, color: "#15803d" }}>
              ✓ Lote registrado correctamente
            </div>
          )}

          {/* Producto */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Producto *</label>
            <select
              value={form.productoId}
              onChange={(e) => setForm((f) => ({ ...f, productoId: e.target.value }))}
              style={{ padding: "0.5rem 0.75rem", borderRadius: 7, border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontSize: "0.875rem" }}
            >
              <option value="">— Seleccionar producto —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.categoriaNombre ? `(${p.categoriaNombre})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Número de lote */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Número / Código de lote *</label>
            <input
              type="text" value={form.numeroLote}
              onChange={(e) => setForm((f) => ({ ...f, numeroLote: e.target.value }))}
              placeholder="Ej: LOT-2026-001 o número de la factura"
              style={{ padding: "0.5rem 0.75rem", borderRadius: 7, border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontSize: "0.875rem" }}
            />
          </div>

          {/* Cantidad */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cantidad *</label>
            <input
              type="number" step="0.01" min="0" value={form.cantidad}
              onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
              placeholder="0"
              style={{ padding: "0.5rem 0.75rem", borderRadius: 7, border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontSize: "0.875rem" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* Fecha entrada */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fecha de entrada</label>
              <InputFecha value={form.fechaEntrada}
                onChange={(e) => setForm((f) => ({ ...f, fechaEntrada: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", borderRadius: 7, border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontSize: "0.875rem" }}
                bg="var(--erp-surface)"
              />
            </div>

            {/* Fecha vencimiento */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Fecha de vencimiento</label>
              <InputFecha value={form.fechaVencimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                style={{ padding: "0.5rem 0.75rem", borderRadius: 7, border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontSize: "0.875rem" }}
                bg="var(--erp-surface)"
              />
              <span style={{ fontSize: "0.68rem", color: "var(--erp-text-3)" }}>Opcional — dejar vacío si no aplica</span>
            </div>
          </div>

          {formError && (
            <div style={{ padding: "0.5rem 0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, fontSize: "0.8rem", color: "#b91c1c" }}>
              {formError}
            </div>
          )}

          <div>
            <button
              disabled={saving}
              onClick={guardar}
              style={{
                padding: "0.55rem 1.25rem", borderRadius: 7, border: "none",
                background: "#1D4ED8", color: "#fff", fontSize: "0.875rem",
                fontWeight: 700, cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Guardando…" : "Registrar Lote"}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: Historial ── */}
      {tab === "historial" && (
        <div>
          {loadingHist ? (
            <p style={{ fontSize: 13, color: "var(--erp-text-3)" }}>Cargando historial…</p>
          ) : historial.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--erp-text-3)" }}>No hay lotes cerrados aún.</p>
          ) : (
            <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
              {historial.map((lote, idx) => (
                <div key={lote.id} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.55rem 0.9rem",
                  borderBottom: idx < historial.length - 1 ? "1px solid var(--erp-border)" : "none",
                  background: "var(--erp-surface-1)",
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--erp-text-1)" }}>{lote.productoNombre}</span>
                    <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--erp-text-3)" }}>Lote: {lote.numeroLote}</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--erp-text-3)", fontVariantNumeric: "tabular-nums" }}>
                    {lote.cantidadActual}/{lote.cantidadInicial} {lote.unidadMedida}
                  </span>
                  {lote.fechaVencimiento && (
                    <span style={{ fontSize: "0.72rem", color: "var(--erp-text-3)" }}>Venció: {formatFecha(lote.fechaVencimiento)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

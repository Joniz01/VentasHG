"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Producto = {
  id: number;
  nombre: string;
  stockActual: number;
  unidadMedida: string;
  categoriaNombre: string | null;
};

type HistorialItem = {
  id: number;
  productoId: number;
  productoNombre: string;
  stockActual: number;
  unidadMedida: string;
  cantidad: number;
  motivoAjuste: string;
  nota: string | null;
  usuarioNombre: string | null;
  createdAt: string;
};

const MOTIVOS: { value: string; label: string }[] = [
  { value: "MERMA",      label: "Merma / Deterioro" },
  { value: "VENCIMIENTO",label: "Vencimiento" },
  { value: "PERDIDA",    label: "Pérdida" },
  { value: "ROBO",       label: "Robo" },
  { value: "CORRECCION", label: "Corrección de inventario" },
  { value: "PRODUCCION", label: "Producción propia" },
  { value: "DONACION",   label: "Donación / Cortesía" },
  { value: "OTRO",       label: "Otro" },
];

const MOTIVO_ICON: Record<string, string> = {
  MERMA: "🗑️", VENCIMIENTO: "⏰", PERDIDA: "❓", ROBO: "🚨",
  CORRECCION: "✏️", PRODUCCION: "🏭", DONACION: "🎁", OTRO: "📝",
};

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type AjusteState = {
  cantidad: string;
  motivo: string;
  nota: string;
  loading: boolean;
  ok: boolean;
  error: string | null;
};

const defaultAjuste = (): AjusteState => ({
  cantidad: "", motivo: "CORRECCION", nota: "", loading: false, ok: false, error: null,
});

type Tab = "registrar" | "historial";

export default function AjustesInventarioClient() {
  const [tab, setTab] = useState<Tab>("registrar");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [ajustes, setAjustes] = useState<Record<number, AjusteState>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const busquedaRef = useRef<HTMLInputElement>(null);

  const fetchHistorial = useCallback(() => {
    setLoadingHistorial(true);
    fetch("/api/inventario/ajustes/historial?limit=30")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setHistorial(Array.isArray(d) ? d : []))
      .catch(() => setHistorial([]))
      .finally(() => setLoadingHistorial(false));
  }, []);

  useEffect(() => {
    fetch("/api/inventario/ajustes")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setProductos(Array.isArray(d) ? d : []))
      .catch(() => setProductos([]))
      .finally(() => setLoadingProductos(false));
    fetchHistorial();
  }, [fetchHistorial]);

  const productosFiltrados = busqueda.trim().length > 0
    ? productos.filter((p) =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : productos;

  function getAjuste(id: number): AjusteState {
    return ajustes[id] ?? defaultAjuste();
  }

  function setAjusteField<K extends keyof AjusteState>(id: number, key: K, val: AjusteState[K]) {
    setAjustes((prev) => ({ ...prev, [id]: { ...(prev[id] ?? defaultAjuste()), [key]: val } }));
  }

  async function registrar(producto: Producto) {
    const aj = getAjuste(producto.id);
    const cantidadNum = parseFloat(aj.cantidad.replace(",", "."));

    if (Number.isNaN(cantidadNum) || cantidadNum === 0) {
      setAjusteField(producto.id, "error", "Ingresa una cantidad distinta de 0");
      return;
    }

    setAjustes((prev) => ({
      ...prev,
      [producto.id]: { ...(prev[producto.id] ?? defaultAjuste()), loading: true, error: null },
    }));

    try {
      const res = await fetch("/api/inventario/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productoId: producto.id,
          cantidad: cantidadNum,
          motivo: aj.motivo,
          nota: aj.nota,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");

      // Actualizar stock en lista local
      setProductos((prev) =>
        prev.map((p) => p.id === producto.id ? { ...p, stockActual: data.stockDespues } : p)
      );

      setAjustes((prev) => ({
        ...prev,
        [producto.id]: { ...defaultAjuste(), ok: true },
      }));

      fetchHistorial();

      setTimeout(() => {
        setAjustes((prev) => ({ ...prev, [producto.id]: defaultAjuste() }));
        setExpandedId(null);
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar";
      setAjustes((prev) => ({
        ...prev,
        [producto.id]: { ...(prev[producto.id] ?? defaultAjuste()), loading: false, error: msg },
      }));
    }
  }

  // Agrupar productos filtrados por categoría
  const grupos: Record<string, Producto[]> = {};
  for (const p of productosFiltrados) {
    const cat = p.categoriaNombre ?? "Sin categoría";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    fontSize: "0.8rem",
    fontWeight: 600,
    border: "none",
    borderBottom: active ? "2px solid #1D4ED8" : "2px solid transparent",
    background: "none",
    color: active ? "#1D4ED8" : "var(--erp-text-3)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: "1.5rem", maxWidth: 860, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--erp-text-1)" }}>
          ⚖️ Ajustes de Inventario
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--erp-text-3)" }}>
          Registra mermas, pérdidas, vencimientos y correcciones de stock
        </p>
      </div>

      {/* Pestañas */}
      <div style={{ borderBottom: "1px solid var(--erp-border)", display: "flex", gap: 0 }}>
        <button style={tabStyle(tab === "registrar")} onClick={() => setTab("registrar")}>
          ⚖️ Registrar ajuste
        </button>
        <button style={tabStyle(tab === "historial")} onClick={() => { setTab("historial"); fetchHistorial(); }}>
          🕓 Historial
          {historial.length > 0 && (
            <span style={{
              marginLeft: 6, background: "var(--erp-surface-2)", border: "1px solid var(--erp-border)",
              borderRadius: 10, padding: "0.05rem 0.45rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--erp-text-3)",
            }}>{historial.length}</span>
          )}
        </button>
      </div>

      {/* ── TAB: Registrar ── */}
      {tab === "registrar" && (
        <>
          {/* Buscador */}
          <div style={{ position: "relative" }}>
            <input
              ref={busquedaRef}
              type="text"
              placeholder="Buscar producto o categoría…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: "100%", padding: "0.55rem 0.9rem", fontSize: "0.875rem",
                border: "1px solid var(--erp-border)", borderRadius: 8,
                background: "var(--erp-surface-1)", color: "var(--erp-text-1)",
                outline: "none", boxSizing: "border-box",
              }}
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--erp-text-3)", fontSize: "1rem", lineHeight: 1,
                }}
              >✕</button>
            )}
          </div>

          {/* Tabla de productos */}
          <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
            {loadingProductos ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
                Cargando productos…
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
                No se encontraron productos
              </div>
            ) : (
              Object.entries(grupos).map(([cat, items]) => (
                <div key={cat}>
                  <div style={{
                    padding: "0.4rem 0.9rem",
                    background: "var(--erp-surface-2)",
                    fontSize: "0.7rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    color: "var(--erp-text-3)",
                    borderBottom: "1px solid var(--erp-border)",
                  }}>
                    {cat} · {items.length}
                  </div>
                  {items.map((producto, idx) => {
                    const aj = getAjuste(producto.id);
                    const expanded = expandedId === producto.id;
                    const cantNum = parseFloat(aj.cantidad.replace(",", "."));
                    const stockPreview = !Number.isNaN(cantNum) && cantNum !== 0
                      ? producto.stockActual + cantNum
                      : null;

                    return (
                      <div key={producto.id}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: "0.75rem",
                          padding: "0.55rem 0.9rem",
                          borderBottom: idx < items.length - 1 || expanded ? "1px solid var(--erp-border)" : "none",
                          background: expanded ? "var(--erp-surface-2)" : "var(--erp-surface-1)",
                        }}>
                          <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500, color: "var(--erp-text-1)" }}>
                            {producto.nombre}
                          </span>
                          <span style={{
                            fontSize: "0.8rem", fontWeight: 700, color: "var(--erp-text-2)",
                            whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right",
                          }}>
                            {producto.stockActual} {producto.unidadMedida}
                          </span>
                          {aj.ok ? (
                            <span style={{
                              fontSize: "0.75rem", fontWeight: 700, color: "#15803d",
                              background: "#f0fdf4", border: "1px solid #bbf7d0",
                              borderRadius: 6, padding: "0.3rem 0.7rem",
                            }}>✓ Registrado</span>
                          ) : (
                            <button
                              onClick={() => setExpandedId(expanded ? null : producto.id)}
                              style={{
                                fontSize: "0.75rem", fontWeight: 600, padding: "0.3rem 0.7rem",
                                borderRadius: 6, border: "1px solid", cursor: "pointer",
                                background: expanded ? "#1D4ED8" : "var(--erp-surface-2)",
                                color: expanded ? "#fff" : "var(--erp-text-2)",
                                borderColor: expanded ? "#1D4ED8" : "var(--erp-border)",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {expanded ? "✕ Cerrar" : "⚖️ Ajustar"}
                            </button>
                          )}
                        </div>

                        {expanded && (
                          <div style={{
                            padding: "1rem 0.9rem", background: "var(--erp-surface-2)",
                            borderBottom: "1px solid var(--erp-border)",
                            display: "flex", flexDirection: "column", gap: "0.75rem",
                          }}>
                            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px" }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Cantidad
                                </label>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    onClick={() => {
                                      const n = parseFloat(aj.cantidad.replace(",", "."));
                                      setAjusteField(producto.id, "cantidad", Number.isNaN(n) ? "-1" : String(-(Math.abs(n))));
                                    }}
                                    style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid var(--erp-border)", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                                  >−</button>
                                  <input
                                    type="number" step="0.01" value={aj.cantidad}
                                    onChange={(e) => setAjusteField(producto.id, "cantidad", e.target.value)}
                                    placeholder="0"
                                    style={{
                                      flex: 1, padding: "0.4rem 0.6rem", borderRadius: 6,
                                      border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)",
                                      color: "var(--erp-text-1)", fontSize: "0.875rem", textAlign: "center",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const n = parseFloat(aj.cantidad.replace(",", "."));
                                      setAjusteField(producto.id, "cantidad", Number.isNaN(n) ? "1" : String(Math.abs(n)));
                                    }}
                                    style={{ padding: "0.4rem 0.6rem", borderRadius: 6, border: "1px solid var(--erp-border)", background: "#f0fdf4", color: "#15803d", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                                  >+</button>
                                </div>
                                {stockPreview !== null && (
                                  <span style={{
                                    fontSize: "0.72rem", fontWeight: 600,
                                    color: stockPreview < 0 ? "#b91c1c" : stockPreview === 0 ? "#B45309" : "#15803d",
                                  }}>
                                    Stock resultante: {stockPreview.toFixed(2)} {producto.unidadMedida}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 180px" }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Motivo
                                </label>
                                <select
                                  value={aj.motivo}
                                  onChange={(e) => setAjusteField(producto.id, "motivo", e.target.value)}
                                  style={{
                                    padding: "0.45rem 0.6rem", borderRadius: 6,
                                    border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)",
                                    color: "var(--erp-text-1)", fontSize: "0.875rem",
                                  }}
                                >
                                  {MOTIVOS.map((m) => (
                                    <option key={m.value} value={m.value}>{MOTIVO_ICON[m.value]} {m.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "2 1 200px" }}>
                                <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Nota (opcional)
                                </label>
                                <input
                                  type="text" value={aj.nota}
                                  onChange={(e) => setAjusteField(producto.id, "nota", e.target.value)}
                                  placeholder="Descripción adicional…"
                                  style={{
                                    padding: "0.45rem 0.6rem", borderRadius: 6,
                                    border: "1px solid var(--erp-border)", background: "var(--erp-surface-1)",
                                    color: "var(--erp-text-1)", fontSize: "0.875rem",
                                  }}
                                />
                              </div>
                            </div>

                            {aj.error && (
                              <div style={{ fontSize: "0.8rem", color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0.4rem 0.7rem" }}>
                                {aj.error}
                              </div>
                            )}

                            <div>
                              <button
                                disabled={aj.loading || !aj.cantidad}
                                onClick={() => registrar(producto)}
                                style={{
                                  padding: "0.5rem 1.1rem", borderRadius: 7, border: "none",
                                  cursor: aj.loading ? "wait" : "pointer",
                                  background: "#1D4ED8", color: "#fff",
                                  fontSize: "0.8rem", fontWeight: 700,
                                  opacity: aj.loading || !aj.cantidad ? 0.6 : 1,
                                }}
                              >
                                {aj.loading ? "Registrando…" : "Registrar Ajuste"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── TAB: Historial ── */}
      {tab === "historial" && (
        <div>
          {loadingHistorial ? (
            <p style={{ fontSize: 13, color: "var(--erp-text-3)" }}>Cargando historial…</p>
          ) : historial.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--erp-text-3)" }}>No hay ajustes registrados aún.</p>
          ) : (
            <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
              {historial.map((h, idx) => (
                <div
                  key={h.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "0.75rem",
                    padding: "0.6rem 0.9rem",
                    borderBottom: idx < historial.length - 1 ? "1px solid var(--erp-border)" : "none",
                    background: "var(--erp-surface-1)",
                  }}
                >
                  <span style={{ fontSize: "1.1rem", flexShrink: 0, lineHeight: 1.4 }}>
                    {MOTIVO_ICON[h.motivoAjuste] ?? "📝"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--erp-text-1)" }}>
                        {h.productoNombre}
                      </span>
                      <span style={{
                        fontSize: "0.75rem", fontWeight: 700,
                        color: h.cantidad > 0 ? "#15803d" : "#b91c1c",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {h.cantidad > 0 ? `+${h.cantidad}` : h.cantidad} {h.unidadMedida}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--erp-text-3)", background: "var(--erp-surface-2)", border: "1px solid var(--erp-border)", borderRadius: 4, padding: "0.1rem 0.4rem" }}>
                        {MOTIVOS.find((m) => m.value === h.motivoAjuste)?.label ?? h.motivoAjuste}
                      </span>
                    </div>
                    {h.nota && (
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--erp-text-3)" }}>{h.nota}</p>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--erp-text-3)" }}>{formatFecha(h.createdAt)}</div>
                    {h.usuarioNombre && (
                      <div style={{ fontSize: "0.7rem", color: "var(--erp-text-3)" }}>{h.usuarioNombre}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

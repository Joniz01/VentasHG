"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const BandejaConteoClient = lazy(() => import("@/components/BandejaConteoClient"));

type FiltroStock = "todos" | "cero" | "bajo_minimo" | "saludable" | "sin_alerta";

type ResumenInventario = {
  enCero: number;
  bajoMinimo: number;
  saludable: number;
  sinAlerta: number;
};

type ProductoLista = {
  id: number;
  nombre: string;
  categoriaNombre: string | null;
  stockActual: number;
  stockMinimo: number;
  unidadMedida: string;
  alertaOutstockDesactivada: boolean;
  alertaOutstockMotivo: string | null;
};

type EstadoStock = "AGOTADO" | "BAJO_MINIMO" | "SALUDABLE" | "SIN_ALERTA";

function computeEstado(p: ProductoLista): EstadoStock {
  if (p.alertaOutstockDesactivada) return "SIN_ALERTA";
  if (p.stockActual <= 0) return "AGOTADO";
  if (p.stockMinimo > 0 && p.stockActual <= p.stockMinimo) return "BAJO_MINIMO";
  return "SALUDABLE";
}

const ESTADO_LABEL: Record<EstadoStock, string> = {
  AGOTADO:     "Agotado",
  BAJO_MINIMO: "Bajo mínimo",
  SALUDABLE:   "Saludable",
  SIN_ALERTA:  "Sin alerta",
};

const ESTADO_STYLE: Record<EstadoStock, React.CSSProperties> = {
  AGOTADO:     { background: "#fde9e9", color: "#b91c1c", fontWeight: 700 },
  BAJO_MINIMO: { background: "#fef3e0", color: "#92400e", fontWeight: 700 },
  SALUDABLE:   { background: "#eafbf1", color: "#15803d", fontWeight: 700 },
  SIN_ALERTA:  { background: "#f3f4f6", color: "#6b7280", fontWeight: 600 },
};

const FILTRO_LABELS: Record<FiltroStock, string> = {
  todos:      "Todos",
  cero:       "En cero",
  bajo_minimo: "Bajo mínimo",
  saludable:  "Saludable",
  sin_alerta: "Sin alerta",
};

// Toggle outstock inline
function OutstockToggle({ producto, onToggled }: { producto: ProductoLista; onToggled: (id: number, val: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [showMotivo, setShowMotivo] = useState(false);
  const [motivo, setMotivo] = useState(producto.alertaOutstockMotivo ?? "");

  async function toggle(desactivada: boolean, motivoFinal?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/outstock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desactivada, motivo: motivoFinal ?? motivo }),
      });
      if (res.ok) {
        onToggled(producto.id, desactivada);
        setShowMotivo(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (producto.alertaOutstockDesactivada) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          disabled={loading}
          onClick={() => toggle(false)}
          title="Reactivar alerta de stock"
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 99, border: "1.5px solid #d1d5db", background: "#f3f4f6", cursor: loading ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "#6b7280", transition: "all .1s", opacity: loading ? 0.5 : 1 }}
        >
          <span style={{ fontSize: 12 }}>🔕</span> Outstock
        </button>
      </div>
    );
  }

  if (showMotivo) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input
          autoFocus
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          style={{ fontSize: 11, padding: "7px 8px", border: "1px solid #fcd34d", borderRadius: 6, background: "#fffbeb", width: "100%", minWidth: 0, outline: "none" }}
          onKeyDown={e => { if (e.key === "Enter") toggle(true); if (e.key === "Escape") setShowMotivo(false); }}
        />
        <button disabled={loading} onClick={() => toggle(true)} style={{ fontSize: 11, fontWeight: 800, padding: "7px 10px", borderRadius: 6, border: "none", background: "#f59e0b", color: "#fff", cursor: "pointer" }}>
          ✓
        </button>
        <button onClick={() => setShowMotivo(false)} style={{ fontSize: 11, padding: "7px 10px", borderRadius: 6, border: "1px solid #e4e7ec", background: "transparent", cursor: "pointer", color: "#6b7280" }}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowMotivo(true)}
      title="Apagar alerta OutStock para este producto"
      style={{ padding: "7px 12px", borderRadius: 99, border: "1.5px dashed #d1d5db", background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#9ca3af", transition: "all .1s" }}
    >
      🔔 Alerta activa
    </button>
  );
}

// Bar fill % capped at 100, color by estado
function StockBar({ p }: { p: ProductoLista }) {
  const estado = computeEstado(p);
  if (estado === "SIN_ALERTA") {
    return <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>—</div>;
  }
  const max = Math.max(p.stockMinimo * 2, p.stockActual, 1);
  const pct = Math.min(100, (p.stockActual / max) * 100);
  const color = estado === "AGOTADO" ? "#dc2626" : estado === "BAJO_MINIMO" ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#e4e7ec", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right", color: "var(--erp-text)" }}>
        {p.stockActual}
      </span>
    </div>
  );
}

type KCard = {
  filtro: FiltroStock;
  emoji: string;
  count: number;
  label: string;
  border: string;
  color: string;
  bg: string;
};

export default function InventarioDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filtroParam = (searchParams.get("filtro") ?? "todos") as FiltroStock;
  const vistaParam  = searchParams.get("vista") ?? "dashboard";

  const [resumen, setResumen] = useState<ResumenInventario | null>(null);
  const [productos, setProductos] = useState<ProductoLista[]>([]);
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [loadingLista, setLoadingLista] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const setFiltro = useCallback((f: FiltroStock) => {
    const p = new URLSearchParams(searchParams.toString());
    if (f === "todos") p.delete("filtro"); else p.set("filtro", f);
    router.push(`?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const setVista = useCallback((v: string) => {
    const p = new URLSearchParams(searchParams.toString());
    if (v === "dashboard") p.delete("vista"); else p.set("vista", v);
    router.push(`?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    setLoadingResumen(true);
    fetch("/api/inventario/resumen")
      .then(r => r.json())
      .then(setResumen)
      .finally(() => setLoadingResumen(false));
  }, []);

  useEffect(() => {
    setLoadingLista(true);
    setBusqueda("");
    fetch(`/api/inventario/lista?filtro=${filtroParam}`)
      .then(r => r.json())
      .then(setProductos)
      .finally(() => setLoadingLista(false));
  }, [filtroParam]);

  const productosFiltrados = busqueda.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) || (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.trim().toLowerCase()))
    : productos;

  const kcards: KCard[] = resumen
    ? [
        { filtro: "cero",       emoji: "🔴", count: resumen.enCero,     label: "En cero (agotados)",   border: "#fca5a5", color: "#b91c1c", bg: "#fef2f2" },
        { filtro: "bajo_minimo",emoji: "🟠", count: resumen.bajoMinimo, label: "Bajo mínimo",           border: "#fcd34d", color: "#92400e", bg: "#fffbeb" },
        { filtro: "saludable",  emoji: "🟢", count: resumen.saludable,  label: "Stock saludable",       border: "#86efac", color: "#15803d", bg: "#f0fdf4" },
        { filtro: "sin_alerta", emoji: "🔕", count: resumen.sinAlerta,  label: "Sin alerta (outstock)", border: "#d1d5db", color: "#6b7280", bg: "#f9fafb" },
      ]
    : [];

  // ---- Bandeja de conteo ----
  if (vistaParam === "bandeja") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--erp-text)" }}>📋 Bandeja de Conteo</h2>
          <button
            onClick={() => setVista("dashboard")}
            style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--erp-text-2)", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}
          >
            ← Dashboard
          </button>
        </div>
        <Suspense fallback={<p style={{ color: "var(--erp-text-2)", fontSize: "0.875rem" }}>Cargando…</p>}>
          <BandejaConteoClient />
        </Suspense>
      </div>
    );
  }

  // ---- Vista simple ----
  if (vistaParam === "simple") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--erp-text)" }}>📦 Existencias</h2>
          <span style={{ fontSize: 12, color: "var(--erp-text-3)", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "3px 10px" }}>Solo lectura</span>
          <button
            onClick={() => setVista("dashboard")}
            style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--erp-primary)", background: "var(--erp-primary-lt)", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer" }}
          >
            ← Dashboard
          </button>
        </div>

        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar producto…"
          style={{ padding: "8px 12px", border: "1px solid var(--erp-border)", borderRadius: 8, fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", outline: "none", maxWidth: 320 }}
        />

        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8, padding: "8px 16px", background: "var(--erp-surface)", borderBottom: "1px solid var(--erp-border)", fontSize: 10, fontWeight: 800, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <div>Producto</div><div style={{ textAlign: "right" }}>Existencia</div>
          </div>
          {loadingLista ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Cargando…</div>
          ) : productosFiltrados.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Sin resultados</div>
          ) : productosFiltrados.map((p, i) => {
            const estado = computeEstado(p);
            const textColor = estado === "AGOTADO" ? "#dc2626" : estado === "BAJO_MINIMO" ? "#d97706" : estado === "SIN_ALERTA" ? "#9ca3af" : "#15803d";
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8, padding: "10px 16px", borderBottom: i < productosFiltrados.length - 1 ? "1px solid var(--erp-border)" : "none", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--erp-text)" }}>{p.nombre}</div>
                  {p.categoriaNombre && <div style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{p.categoriaNombre}</div>}
                </div>
                <div style={{ textAlign: "right", fontWeight: 800, fontSize: 15, fontVariantNumeric: "tabular-nums", color: textColor }}>
                  {p.stockActual}
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--erp-text-3)" }}>{p.unidadMedida}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- Dashboard ----
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div className="inv-header">
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--erp-text)" }}>📦 Dashboard de Inventario</h2>
          <div style={{ fontSize: 12, color: "var(--erp-text-3)", marginTop: 2 }}>
            {resumen ? `${resumen.enCero + resumen.bajoMinimo + resumen.saludable + resumen.sinAlerta} productos activos` : "Cargando…"}
          </div>
        </div>
        <div className="inv-header-btns">
          <button
            onClick={() => setVista("bandeja")}
            style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-primary)", background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            📋 Bandeja de conteo
          </button>
          <button
            onClick={() => setVista("simple")}
            style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-text-2)", background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Vista simple →
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="inv-kpi-grid">
        {loadingResumen
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: "16px", height: 90, opacity: 0.5 }} />
            ))
          : kcards.map(card => (
              <button
                key={card.filtro}
                onClick={() => setFiltro(filtroParam === card.filtro ? "todos" : card.filtro)}
                style={{
                  background: filtroParam === card.filtro ? card.bg : "var(--erp-surface)",
                  border: `1.5px solid ${filtroParam === card.filtro ? card.border : "var(--erp-border)"}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.12s",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: card.border, borderRadius: "12px 0 0 12px" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginLeft: 6 }}>
                  <span style={{ fontSize: 16 }}>{card.emoji}</span>
                  <span style={{ fontSize: 10, color: card.color, fontWeight: 800, opacity: filtroParam === card.filtro ? 1 : 0, transition: "opacity .12s" }}>● activo</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: card.color, margin: "6px 0 2px 6px", lineHeight: 1 }}>{card.count}</div>
                <div style={{ fontSize: 11, color: "var(--erp-text-2)", fontWeight: 600, marginLeft: 6 }}>{card.label}</div>
              </button>
            ))
        }
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar">
        {(["todos", "cero", "bajo_minimo", "saludable", "sin_alerta"] as FiltroStock[]).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: `1.5px solid ${filtroParam === f ? "var(--erp-primary)" : "var(--erp-border)"}`,
              background: filtroParam === f ? "var(--erp-primary-lt)" : "transparent",
              color: filtroParam === f ? "var(--erp-primary)" : "var(--erp-text-2)",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              transition: "all .1s",
              whiteSpace: "nowrap",
            }}
          >
            {FILTRO_LABELS[f]}
            {resumen && f !== "todos" && (
              <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.75 }}>
                ({f === "cero" ? resumen.enCero : f === "bajo_minimo" ? resumen.bajoMinimo : f === "saludable" ? resumen.saludable : resumen.sinAlerta})
              </span>
            )}
          </button>
        ))}
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="🔍 Buscar…"
          className="inv-search"
          style={{ padding: "6px 12px", border: "1px solid var(--erp-border)", borderRadius: 8, fontSize: 12, background: "var(--erp-bg)", color: "var(--erp-text)", outline: "none" }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden" }}>
        {/* Header */}
        <div className="inv-table-header" style={{ background: "var(--erp-surface-2, var(--erp-surface))", borderBottom: "1px solid var(--erp-border)", fontSize: 10, fontWeight: 800, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <div></div>
          <div>Producto</div>
          <div className="inv-col-categoria">Categoría</div>
          <div className="inv-col-existencia">Existencia</div>
          <div className="inv-col-minimo" style={{ textAlign: "right" }}>Mínimo</div>
          <div className="inv-col-estado">Estado</div>
          <div>Alerta OutStock</div>
        </div>

        {loadingLista ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Cargando…</div>
        ) : productosFiltrados.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
            {busqueda ? "Sin resultados para esa búsqueda" : "No hay productos en esta categoría"}
          </div>
        ) : productosFiltrados.map((p, i) => {
          const estado = computeEstado(p);
          const emoji = estado === "AGOTADO" ? "🔴" : estado === "BAJO_MINIMO" ? "🟠" : estado === "SIN_ALERTA" ? "🔕" : "🟢";
          return (
            <div
              key={p.id}
              className="inv-table-row"
              style={{
                borderBottom: i < productosFiltrados.length - 1 ? "1px solid var(--erp-border)" : "none",
                background: estado === "AGOTADO" ? "rgba(220,38,38,0.03)" : estado === "SIN_ALERTA" ? "rgba(0,0,0,0.01)" : "transparent",
              }}
            >
              <div style={{ fontSize: 15, textAlign: "center" }}>{emoji}</div>
              <div className="inv-col-nombre">
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--erp-text)" }}>{p.nombre}</div>
                {/* Stock visible solo en móvil (la col existencia se oculta) */}
                <div className="inv-col-nombre-stock">
                  <span style={{ fontSize: 11, color: "var(--erp-text-2)" }}>
                    Stock: <strong style={{ fontVariantNumeric: "tabular-nums", color: estado === "AGOTADO" ? "#dc2626" : estado === "BAJO_MINIMO" ? "#d97706" : "var(--erp-text)" }}>{p.stockActual}</strong>
                  </span>
                  <span style={{ ...ESTADO_STYLE[estado], fontSize: 10, padding: "1px 7px", borderRadius: 99, display: "inline-block" }}>
                    {ESTADO_LABEL[estado]}
                  </span>
                </div>
                {p.alertaOutstockMotivo && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>{p.alertaOutstockMotivo}</div>}
              </div>
              <div className="inv-col-categoria" style={{ fontSize: 12, color: "var(--erp-text-2)" }}>{p.categoriaNombre ?? "—"}</div>
              <div className="inv-col-existencia"><StockBar p={p} /></div>
              <div className="inv-col-minimo" style={{ textAlign: "right", fontSize: 12, color: "var(--erp-text-3)", fontVariantNumeric: "tabular-nums" }}>
                {p.stockMinimo > 0 ? p.stockMinimo : "—"}
              </div>
              <div className="inv-col-estado">
                <span style={{ ...ESTADO_STYLE[estado], fontSize: 11, padding: "2px 9px", borderRadius: 99, display: "inline-block", whiteSpace: "nowrap" }}>
                  {ESTADO_LABEL[estado]}
                </span>
              </div>
              <div>
                <OutstockToggle
                  producto={p}
                  onToggled={(id, val) => {
                    setProductos(prev => prev.map(x => x.id === id ? { ...x, alertaOutstockDesactivada: val, alertaOutstockMotivo: val ? x.alertaOutstockMotivo : null } : x));
                    fetch("/api/inventario/resumen").then(r => r.json()).then(setResumen);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer count */}
      {!loadingLista && (
        <div style={{ fontSize: 12, color: "var(--erp-text-3)", textAlign: "right" }}>
          {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
          {filtroParam !== "todos" ? ` · filtro: ${FILTRO_LABELS[filtroParam]}` : ""}
        </div>
      )}
    </div>
  );
}

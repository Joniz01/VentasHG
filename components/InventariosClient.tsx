"use client";

import { Fragment, useEffect, useState, FormEvent } from "react";
import type { EstadoStock, MovimientoInventario, Producto } from "@/lib/types";
import { ajustarCantidadConFlechas } from "@/lib/cantidad";

function computeEstadoStock(p: Producto): EstadoStock {
  if (p.alertaOutstockDesactivada) return "SIN_ALERTA";
  if (p.stockActual <= 0) return "AGOTADO";
  if (p.stockMinimo > 0 && p.stockActual <= p.stockMinimo) return "BAJO_MINIMO";
  return "SALUDABLE";
}

const ESTADO_STOCK_LABEL: Record<EstadoStock, string> = {
  AGOTADO: "Agotado",
  BAJO_MINIMO: "Bajo mínimo",
  SALUDABLE: "Saludable",
  SIN_ALERTA: "Sin alerta",
};

const ESTADO_STOCK_STYLE: Record<EstadoStock, React.CSSProperties> = {
  AGOTADO:     { background: "#fde9e9", color: "#b91c1c", fontWeight: 700 },
  BAJO_MINIMO: { background: "#fef3e0", color: "#92400e", fontWeight: 700 },
  SALUDABLE:   { background: "#eafbf1", color: "#15803d", fontWeight: 700 },
  SIN_ALERTA:  { background: "#f3f4f6", color: "#6b7280", fontWeight: 600 },
};

const TIPO_MOVIMIENTO_LABELS: Record<MovimientoInventario["tipo"], string> = {
  ENTRADA: "Entrada",
  AJUSTE: "Ajuste",
  VENTA: "Venta",
};

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Historial + formulario por producto ──────────────────────────────────────
function MovimientosProducto({
  producto,
  onStockChange,
}: {
  producto: Producto;
  onStockChange: (id: number, nuevoStock: number) => void;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loadingMov, setLoadingMov] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [stockActual, setStockActual] = useState(producto.stockActual);

  async function loadMovimientos() {
    try {
      const res = await fetch(`/api/productos/${producto.id}/inventario`);
      const data = (await res.json()) as MovimientoInventario[];
      setMovimientos(data);
    } catch {
      setError("No se pudo cargar el historial");
    } finally {
      setLoadingMov(false);
    }
  }

  useEffect(() => { loadMovimientos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cantidadNum = Number(cantidad);
    if (Number.isNaN(cantidadNum) || cantidadNum === 0) { setError("Indica una cantidad válida"); return; }
    if (tipo === "ENTRADA" && cantidadNum <= 0) { setError("La cantidad de una entrada debe ser mayor a 0"); return; }
    if (tipo === "AJUSTE" && !nota.trim()) { setError("Indica el motivo del ajuste"); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/inventario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, cantidad: cantidadNum, nota: nota.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al registrar el movimiento");
      setStockActual(data.stockActual);
      onStockChange(producto.id, data.stockActual);
      setCantidad(""); setNota("");
      await loadMovimientos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el movimiento");
    } finally {
      setSaving(false);
    }
  }

  if (producto.alertaOutstockDesactivada) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>
          Inventario de &quot;{producto.nombre}&quot; — Stock actual: {stockActual}
        </p>
        <div style={{ background: "#fef3e0", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
          <strong>🔕 Alerta OutStock desactivada.</strong> Para registrar un movimiento ve a la ficha del producto y desmarca <em>"Apagar Alerta OutStock"</em>.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>
        Inventario de &quot;{producto.nombre}&quot; — Stock actual: <strong>{stockActual}</strong>
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-2)" }}>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ENTRADA" | "AJUSTE")}
            style={{ padding: "6px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)" }}
          >
            <option value="ENTRADA">Entrada (agregar)</option>
            <option value="AJUSTE">Ajuste (corrección)</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-2)" }}>Cantidad {tipo === "AJUSTE" ? "(+ o −)" : ""}</label>
          <input
            type="number" step="1" value={cantidad}
            onChange={(e) => setCantidad(ajustarCantidadConFlechas(cantidad, e.target.value))}
            placeholder={tipo === "AJUSTE" ? "Ej: -2" : "Ej: 10"}
            style={{ width: 100, padding: "6px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 140 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-2)" }}>Nota {tipo === "AJUSTE" ? "(obligatoria)" : "(opcional)"}</label>
          <input
            value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Motivo"
            style={{ padding: "6px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", width: "100%" }}
          />
        </div>
        <button
          type="submit" disabled={saving}
          style={{ padding: "6px 16px", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          Registrar
        </button>
      </form>

      {error && <p style={{ margin: 0, color: "#dc2626", fontSize: 13 }}>{error}</p>}

      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--erp-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--erp-surface)", borderBottom: "1px solid var(--erp-border)" }}>
              {["Fecha", "Tipo", "Cantidad", "Nota", "Quién"].map((h, i) => (
                <th key={h} style={{ padding: "6px 12px", textAlign: i === 2 ? "right" : "left", fontWeight: 600, fontSize: 11, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingMov && <tr><td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "var(--erp-text-3)" }}>Cargando…</td></tr>}
            {!loadingMov && movimientos.length === 0 && <tr><td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "var(--erp-text-3)" }}>Sin movimientos registrados</td></tr>}
            {movimientos.map((mov) => (
              <tr key={mov.id} style={{ borderBottom: "1px solid var(--erp-border)" }}>
                <td style={{ padding: "6px 12px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{formatFechaHora(mov.createdAt)}</td>
                <td style={{ padding: "6px 12px" }}>{TIPO_MOVIMIENTO_LABELS[mov.tipo]}</td>
                <td style={{ padding: "6px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: mov.cantidad > 0 ? "#15803d" : mov.cantidad < 0 ? "#dc2626" : undefined }}>
                  {mov.cantidad > 0 ? `+${mov.cantidad}` : mov.cantidad}
                </td>
                <td style={{ padding: "6px 12px", color: "var(--erp-text-2)" }}>{mov.nota ?? "—"}</td>
                <td style={{ padding: "6px 12px", color: "var(--erp-text-3)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {mov.origen === "VENTA" ? <span title={`Venta #${mov.ventaId ?? ""}`}>🛒 Sistema</span>
                    : mov.origen === "CONTEO" ? <span>📋 Conteo</span>
                    : mov.usuarioNombre ? <span>👤 {mov.usuarioNombre}</span>
                    : <span>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── KPI types ─────────────────────────────────────────────────────────────────
type InventariosKpis = {
  productosEnStock: number;
  valorInventario: number;
  sinStock: number;
  unidadesTotales: number;
  entradasMesUsd: number;
  movimientosMes: number;
};

const PAGE_SIZE_OPTIONS = [10, 15, 20, 50];

type ModalArmarEmpaque = {
  producto: Producto;
  empaqueRelId: number;
  empaqueNombre: string;
  rendimiento: number;
  unidadesInput: string;
  armando: boolean;
  error: string | null;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function InventariosClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [kpis, setKpis] = useState<InventariosKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [modalArmar, setModalArmar] = useState<ModalArmarEmpaque | null>(null);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductos(data))
      .finally(() => setLoading(false));

    fetch("/api/inventarios/kpis")
      .then((r) => r.json())
      .then((data) => setKpis(data))
      .finally(() => setKpisLoading(false));
  }, []);

  async function handleArmarEmpaque() {
    if (!modalArmar) return;
    const unidades = Number(modalArmar.unidadesInput);
    if (!unidades || unidades < 1) return;
    setModalArmar((prev) => prev ? { ...prev, armando: true, error: null } : null);
    try {
      const res = await fetch("/api/inventario/armar-empaque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empaqueRelId: modalArmar.empaqueRelId, unidadesAUsar: unidades }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al armar empaque");
      // Actualizar stock localmente
      setProductos((prev) => prev.map((p) => {
        if (p.id === modalArmar.producto.id) return { ...p, stockActual: p.stockActual - unidades };
        const emp = modalArmar.producto.empaques.find(e => e.id === modalArmar.empaqueRelId);
        if (emp && p.id === emp.empaqueId) return { ...p, stockActual: p.stockActual + data.empaquesGenerados };
        return p;
      }));
      fetch("/api/inventarios/kpis").then((r) => r.json()).then(setKpis);
      setModalArmar(null);
    } catch (err) {
      setModalArmar((prev) => prev ? { ...prev, armando: false, error: err instanceof Error ? err.message : "Error" } : null);
    }
  }

  function handleStockChange(id: number, nuevoStock: number) {
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, stockActual: nuevoStock } : p)));
    fetch("/api/inventarios/kpis").then((r) => r.json()).then(setKpis);
  }

  const productosInventario = productos.filter((p) => p.tipoProducto === "NORMAL");

  const productosFiltrados = busqueda.trim()
    ? productosInventario.filter(
        (p) =>
          p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : productosInventario;

  const totalPages = Math.max(1, Math.ceil(productosFiltrados.length / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const productosPagina = productosFiltrados.slice((paginaActual - 1) * pageSize, paginaActual * pageSize);

  function cambiarBusqueda(val: string) { setBusqueda(val); setPage(1); setExpandedId(null); }
  function cambiarPageSize(val: number) { setPageSize(val); setPage(1); setExpandedId(null); }

  const kpiCards = [
    { label: "Productos en Stock", value: kpisLoading ? "…" : String(kpis?.productosEnStock ?? 0), sub: "con unidades disponibles", color: "var(--erp-text)" },
    { label: "Valor del Inventario", value: kpisLoading ? "…" : `$${(kpis?.valorInventario ?? 0).toFixed(2)}`, sub: "stock × costo", color: "#15803d" },
    { label: "Sin Stock", value: kpisLoading ? "…" : String(kpis?.sinStock ?? 0), sub: "productos en 0 unidades", color: (kpis?.sinStock ?? 0) > 0 ? "#dc2626" : "var(--erp-text)" },
    { label: "Unidades Totales", value: kpisLoading ? "…" : String(kpis?.unidadesTotales ?? 0), sub: "suma de todo el stock", color: "#1d4ed8" },
    { label: "Entradas del Mes", value: kpisLoading ? "…" : `$${(kpis?.entradasMesUsd ?? 0).toFixed(2)}`, sub: "inversión en reabastecimiento", color: "#7c3aed" },
    { label: "Movimientos del Mes", value: kpisLoading ? "…" : String(kpis?.movimientosMes ?? 0), sub: "entradas y ajustes", color: "#d97706" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {kpiCards.map((card) => (
          <div
            key={card.label}
            style={{ display: "flex", flexDirection: "column", gap: 4, borderRadius: 10, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", padding: "12px 14px" }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: card.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{card.value}</span>
            <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => cambiarBusqueda(e.target.value)}
          placeholder="🔍 Buscar producto o categoría…"
          style={{ flex: "1 1 200px", minWidth: 0, padding: "7px 12px", border: "1px solid var(--erp-border)", borderRadius: 8, fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", outline: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "var(--erp-text-2)" }}>Mostrar</span>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => cambiarPageSize(n)}
              style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${pageSize === n ? "var(--erp-primary)" : "var(--erp-border)"}`, background: pageSize === n ? "var(--erp-primary-lt)" : "transparent", color: pageSize === n ? "var(--erp-primary)" : "var(--erp-text-2)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla con paginación */}
      <div style={{ borderRadius: 12, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--erp-surface)", borderBottom: "1px solid var(--erp-border)" }}>
                <th style={thStyle}>Producto</th>
                <th style={{ ...thStyle, display: "none" }} className="inv-sc-cat">Categoría</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Stock</th>
                <th style={{ ...thStyle, textAlign: "right" }} className="inv-sc-min">Mínimo</th>
                <th className="inv-sc-estado" style={thStyle}>Estado</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--erp-text-3)" }}>Cargando…</td></tr>
              )}
              {!loading && productosFiltrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--erp-text-3)" }}>
                  {busqueda ? "Sin resultados para esa búsqueda" : "No hay productos con inventario"}
                </td></tr>
              )}
              {productosPagina.map((producto, i) => {
                const estado = computeEstadoStock(producto);
                const isExpanded = expandedId === producto.id;
                return (
                  <Fragment key={producto.id}>
                    <tr style={{ borderBottom: "1px solid var(--erp-border)", background: isExpanded ? "var(--erp-primary-lt)" : i % 2 === 1 ? "rgba(0,0,0,0.015)" : "transparent" }}>
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ fontWeight: 600, color: "var(--erp-text)" }}>{producto.nombre}</div>
                        {/* Categoría visible solo en móvil bajo el nombre */}
                        <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 1 }} className="inv-sc-cat-mobile">
                          {producto.categoriaNombre ?? ""}
                        </div>
                      </td>
                      <td style={{ padding: "9px 14px", color: "var(--erp-text-2)", fontSize: 12, display: "none" }} className="inv-sc-cat">
                        {producto.categoriaNombre ?? "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: producto.stockActual <= 0 ? "#dc2626" : "var(--erp-text)" }}>
                        {producto.stockActual}
                        <span style={{ fontSize: 10, color: "var(--erp-text-3)", marginLeft: 3 }}>{producto.unidadMedida}</span>
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: "var(--erp-text-3)", fontSize: 12, fontVariantNumeric: "tabular-nums", display: "none" }} className="inv-sc-min">
                        {producto.stockMinimo > 0 ? producto.stockMinimo : "—"}
                      </td>
                      <td className="inv-sc-estado" style={{ padding: "9px 14px" }}>
                        <span style={{ ...ESTADO_STOCK_STYLE[estado], fontSize: 11, padding: "2px 8px", borderRadius: 99, display: "inline-block", whiteSpace: "nowrap" }}>
                          {ESTADO_STOCK_LABEL[estado]}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {producto.empaques && producto.empaques.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const emp = producto.empaques[0];
                                setModalArmar({
                                  producto,
                                  empaqueRelId: emp.id,
                                  empaqueNombre: emp.empaqueNombre,
                                  rendimiento: emp.rendimiento,
                                  unidadesInput: String(emp.rendimiento),
                                  armando: false,
                                  error: null,
                                });
                              }}
                              style={{ padding: "4px 12px", border: "1.5px solid #d97706", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "#fffbeb", color: "#92400e", whiteSpace: "nowrap" }}
                            >
                              📦 Armar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : producto.id)}
                            style={{ padding: "7px 12px", border: `1.5px solid ${isExpanded ? "var(--erp-primary)" : "var(--erp-border)"}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: isExpanded ? "var(--erp-primary)" : "var(--erp-surface)", color: isExpanded ? "#fff" : "var(--erp-text-2)", whiteSpace: "nowrap" }}
                          >
                            <span className="inv-btn-full">{isExpanded ? "Ocultar ▲" : "Movimientos ▼"}</span>
                            <span className="inv-btn-short">{isExpanded ? "▲" : "▼"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} style={{ padding: "16px 14px", background: "var(--erp-bg)", borderBottom: "1px solid var(--erp-border)" }}>
                          <MovimientosProducto producto={producto} onStockChange={handleStockChange} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid var(--erp-border)", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--erp-text-2)" }}>
              {(paginaActual - 1) * pageSize + 1}–{Math.min(paginaActual * pageSize, productosFiltrados.length)} de {productosFiltrados.length} productos
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={paginaActual === 1}
                style={pageBtn(paginaActual === 1)}
              >«</button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                style={pageBtn(paginaActual === 1)}
              >‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(paginaActual - 2, totalPages - 4));
                const n = start + i;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    style={{ ...pageBtn(false), background: n === paginaActual ? "var(--erp-primary)" : "transparent", color: n === paginaActual ? "#fff" : "var(--erp-text-2)", borderColor: n === paginaActual ? "var(--erp-primary)" : "var(--erp-border)" }}
                  >{n}</button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={paginaActual === totalPages}
                style={pageBtn(paginaActual === totalPages)}
              >›</button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={paginaActual === totalPages}
                style={pageBtn(paginaActual === totalPages)}
              >»</button>
            </div>
          </div>
        )}
      </div>

      {/* Conteo footer */}
      {!loading && (
        <div style={{ fontSize: 12, color: "var(--erp-text-3)", textAlign: "right" }}>
          {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
          {busqueda ? ` · búsqueda: "${busqueda}"` : ""}
        </div>
      )}

      {/* ── Modal Armar Empaque ── */}
      {modalArmar && (() => {
        const unidades = Number(modalArmar.unidadesInput) || 0;
        const esMultiplo = unidades > 0 && unidades % modalArmar.rendimiento === 0;
        const empaquesGenerados = esMultiplo ? Math.floor(unidades / modalArmar.rendimiento) : 0;
        const stockDisponible = modalArmar.producto.stockActual;
        const stockInsuficiente = unidades > stockDisponible;
        const puedeConfirmar = esMultiplo && !stockInsuficiente && !modalArmar.armando && unidades > 0;

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, maxWidth: 460, width: "100%", overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
              {/* Header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--erp-border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📦</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)" }}>Armar empaque</div>
                  <div style={{ fontSize: 12, color: "var(--erp-text-2)" }}>Convierte unidades en su empaque origen</div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Producto origen */}
                <div style={{ background: "var(--erp-bg)", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                  <div style={{ color: "var(--erp-text-2)", fontSize: 11, marginBottom: 3 }}>PRODUCTO A CONSUMIR</div>
                  <div style={{ fontWeight: 700, color: "var(--erp-text)" }}>{modalArmar.producto.nombre}</div>
                  <div style={{ color: "var(--erp-text-3)", fontSize: 12 }}>Stock actual: {stockDisponible} {modalArmar.producto.unidadMedida}</div>
                </div>

                {/* Empaque destino */}
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                  <div style={{ color: "#92400E", fontSize: 11, marginBottom: 3 }}>EMPAQUE A GENERAR</div>
                  <div style={{ fontWeight: 700, color: "#78350F" }}>{modalArmar.empaqueNombre}</div>
                  <div style={{ color: "#92400E", fontSize: 12 }}>Requiere {modalArmar.rendimiento} unidades por empaque</div>
                </div>

                {/* Input cantidad */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-text-2)" }}>
                    ¿Cuántas unidades deseas reempaquetar?
                  </label>
                  <input
                    type="number"
                    min="1"
                    step={modalArmar.rendimiento}
                    value={modalArmar.unidadesInput}
                    onChange={(e) => setModalArmar((prev) => prev ? { ...prev, unidadesInput: e.target.value, error: null } : null)}
                    style={{ border: `1.5px solid ${!esMultiplo && unidades > 0 ? "#EF4444" : "var(--erp-border)"}`, borderRadius: 6, padding: "8px 12px", fontSize: 14, fontWeight: 700, width: "100%", background: "var(--erp-bg)", color: "var(--erp-text)" }}
                  />
                  {unidades > 0 && !esMultiplo && (
                    <div style={{ fontSize: 11, color: "#EF4444" }}>
                      Debe ser múltiplo de {modalArmar.rendimiento} (valores válidos: {modalArmar.rendimiento}, {modalArmar.rendimiento * 2}, {modalArmar.rendimiento * 3}…)
                    </div>
                  )}
                  {stockInsuficiente && (
                    <div style={{ fontSize: 11, color: "#EF4444" }}>
                      Stock insuficiente. Solo hay {stockDisponible} unidades disponibles.
                    </div>
                  )}
                </div>

                {/* Vista previa */}
                {esMultiplo && !stockInsuficiente && unidades > 0 && (
                  <div style={{ background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                    <div style={{ fontWeight: 700, color: "#065F46", marginBottom: 4 }}>✓ Resultado si confirmas</div>
                    <div style={{ color: "#047857" }}>📦 {modalArmar.producto.nombre}: −{unidades} unidades (quedan {stockDisponible - unidades})</div>
                    <div style={{ color: "#047857" }}>+ {empaquesGenerados} {empaquesGenerados === 1 ? "empaque generado" : "empaques generados"}: <strong>{modalArmar.empaqueNombre}</strong></div>
                  </div>
                )}

                {modalArmar.error && (
                  <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#DC2626" }}>
                    {modalArmar.error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 18px", borderTop: "1px solid var(--erp-border)", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setModalArmar(null)}
                  style={{ background: "transparent", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "8px 16px", fontSize: 13, color: "var(--erp-text-2)", cursor: "pointer" }}
                >Cancelar</button>
                <button
                  type="button"
                  onClick={handleArmarEmpaque}
                  disabled={!puedeConfirmar}
                  style={{ flex: 1, background: puedeConfirmar ? "#D97706" : "var(--erp-border)", color: puedeConfirmar ? "#fff" : "var(--erp-text-3)", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: puedeConfirmar ? "pointer" : "not-allowed" }}
                >{modalArmar.armando ? "Armando…" : `✓ Armar ${empaquesGenerados > 0 ? empaquesGenerados : ""} empaque${empaquesGenerados !== 1 ? "s" : ""}`}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Estilos base ──────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "8px 14px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 800,
  color: "var(--erp-text-3)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "4px 9px",
    border: "1px solid var(--erp-border)",
    borderRadius: 6,
    background: "transparent",
    color: disabled ? "var(--erp-text-3)" : "var(--erp-text-2)",
    fontSize: 13,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

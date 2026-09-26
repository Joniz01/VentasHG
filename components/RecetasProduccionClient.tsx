"use client";

import { useState, useEffect, useCallback } from "react";

type ProductoRP = {
  id: number;
  nombre: string;
  grupo: string;
  subtipo_fabricacion: string | null;
  categoriaNombre: string | null;
  rendimiento: number;
  totalInsumos: number;
};

type Insumo = {
  id: number;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
};

type RPItem = {
  id: number;
  insumoId: number;
  insumoNombre: string;
  insumoUnidad: string;
  stockInsumo: number;
  insumoAprovisionamiento: string;
  insumoSubtipo: string | null;
  cantidad: number;
  factorMerma: number;
  unidadMedida: string;
  notas: string | null;
  orden: number;
};

type Necesidad = {
  insumoId: number;
  nombre: string;
  unidadMedida: string;
  necesario: number;
  disponible: number;
  deficit: number;
  ok: boolean;
};

type SimResult = {
  producto: { id: number; nombre: string; rendimiento: number };
  cantidadSolicitada: number;
  maxProducible: number;
  puedeProducir: boolean;
  necesidades: Necesidad[];
};

function fmt(n: number, d = 3) {
  return n.toLocaleString("es-VE", { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export default function RecetasProduccionClient() {
  const [tab, setTab] = useState<"recetas" | "simular">("recetas");
  const [productos, setProductos] = useState<ProductoRP[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recetas
  const [expandido, setExpandido] = useState<number | null>(null);
  const [rpItems, setRpItems] = useState<Record<number, RPItem[]>>({});
  const [loadingRp, setLoadingRp] = useState<Record<number, boolean>>({});
  const [busqueda, setBusqueda] = useState("");
  // Nuevo insumo
  const [nuevoItem, setNuevoItem] = useState<Record<number, { insumoId: string; cantidad: string; factorMerma: string; notas: string }>>({});
  const [guardandoItem, setGuardandoItem] = useState<Record<number, boolean>>({});

  // Simulación
  const [simProductoId, setSimProductoId] = useState<string>("");
  const [simCantidad, setSimCantidad] = useState<string>("1");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    fetch("/api/productos/bom")
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error ?? "Error")))
      .then((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setProductos(d.productos.map((p: any) => ({ ...p, totalInsumos: p.totalInsumos ?? p.total_insumos ?? 0 })));
        setInsumos(d.insumos);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function cargarRP(id: number) {
    if (rpItems[id]) return;
    setLoadingRp((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/productos/bom/${id}`);
      const d = await res.json();
      setRpItems((p) => ({ ...p, [id]: d.items ?? [] }));
    } finally {
      setLoadingRp((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  function toggleExpandido(id: number) {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    cargarRP(id);
  }

  async function eliminarItem(productoId: number, itemId: number) {
    await fetch(`/api/productos/bom/${productoId}?itemId=${itemId}`, { method: "DELETE" });
    setRpItems((p) => ({ ...p, [productoId]: (p[productoId] ?? []).filter((i) => i.id !== itemId) }));
    setProductos((prev) => prev.map((p) => p.id === productoId ? { ...p, totalInsumos: Math.max(0, p.totalInsumos - 1) } : p));
  }

  async function agregarItem(productoId: number) {
    const ni = nuevoItem[productoId];
    if (!ni?.insumoId || !ni?.cantidad) return;
    const insumoSel = [...insumos, ...productos].find((i) => i.id === Number(ni.insumoId));
    const unidad = (insumoSel as Insumo)?.unidadMedida ?? "unidad";
    setGuardandoItem((p) => ({ ...p, [productoId]: true }));
    try {
      const res = await fetch(`/api/productos/bom/${productoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insumoId: Number(ni.insumoId),
          cantidad: Number(ni.cantidad),
          factorMerma: Number(ni.factorMerma) > 1 ? Number(ni.factorMerma) : 1,
          unidadMedida: unidad,
          notas: ni.notas || null,
        }),
      });
      if (!res.ok) throw new Error("Error al agregar");
      // Recargar RP
      delete rpItems[productoId];
      await cargarRP(productoId);
      setNuevoItem((p) => { const n = { ...p }; delete n[productoId]; return n; });
      setProductos((prev) => prev.map((p) => p.id === productoId ? { ...p, totalInsumos: p.totalInsumos + 1 } : p));
    } catch { alert("Error al agregar insumo"); }
    finally { setGuardandoItem((p) => { const n = { ...p }; delete n[productoId]; return n; }); }
  }

  async function simular() {
    if (!simProductoId || !simCantidad) return;
    setSimLoading(true); setSimResult(null); setSimError(null);
    try {
      const res = await fetch("/api/productos/bom/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productoId: Number(simProductoId), cantidad: Number(simCantidad) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Error");
      setSimResult(d);
    } catch (e) { setSimError(String(e)); }
    finally { setSimLoading(false); }
  }

  if (loading) return <div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando recetas…</div>;
  if (error) return <div style={{ padding: 24, color: "#b91c1c", fontSize: 13 }}>{error}</div>;

  const listaFiltrada = productos.filter((p) =>
    !busqueda.trim() ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const btnTab = (t: typeof tab): React.CSSProperties => ({
    padding: "0.5rem 1.1rem", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600,
    borderBottom: tab === t ? "2px solid #1D4ED8" : "2px solid transparent",
    background: "transparent", color: tab === t ? "#1D4ED8" : "var(--erp-text-3)",
  });

  return (
    <div style={{ padding: "1.5rem", maxWidth: 980, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--erp-text-1)" }}>
          📐 Recetas de Producción (RP)
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--erp-text-3)" }}>
          Define los insumos y cantidades necesarios para producir cada producto terminado.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--erp-border)", display: "flex", gap: 0 }}>
        <button style={btnTab("recetas")} onClick={() => setTab("recetas")}>📋 Recetas</button>
        <button style={btnTab("simular")} onClick={() => setTab("simular")}>🧪 Simular RP</button>
      </div>

      {/* ===== TAB: RECETAS ===== */}
      {tab === "recetas" && (
        <>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <input
                type="text" placeholder="Buscar producto…" value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.8rem", fontSize: "0.875rem", border: "1px solid var(--erp-border)", borderRadius: 8, background: "var(--erp-surface-1)", color: "var(--erp-text-1)", outline: "none", boxSizing: "border-box" }}
              />
              {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)" }}>✕</button>}
            </div>
            <span style={{ fontSize: "0.78rem", color: "var(--erp-text-3)" }}>{listaFiltrada.length} productos</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {listaFiltrada.length === 0 && (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Sin resultados</div>
            )}
            {listaFiltrada.map((p) => {
              const isOpen = expandido === p.id;
              const items = rpItems[p.id] ?? [];
              const ni = nuevoItem[p.id];

              return (
                <div key={p.id} style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
                  {/* Fila producto */}
                  <div
                    onClick={() => toggleExpandido(p.id)}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 1rem", cursor: "pointer", background: isOpen ? "#eff6ff" : "var(--erp-surface-1)", userSelect: "none" }}
                  >
                    <span style={{ fontSize: "0.9rem" }}>{isOpen ? "▼" : "▶"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--erp-text-1)" }}>{p.nombre}</div>
                      {p.categoriaNombre && <div style={{ fontSize: "0.68rem", color: "var(--erp-text-3)" }}>{p.categoriaNombre}</div>}
                    </div>
                    {p.subtipo_fabricacion && (
                      <span style={{
                        fontSize: "0.68rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 20,
                        background: p.subtipo_fabricacion === "RECETA_BASE" ? "#fef3c7" : p.subtipo_fabricacion === "ENSAMBLADO" ? "#ede9fe" : "#dcfce7",
                        color: p.subtipo_fabricacion === "RECETA_BASE" ? "#92400e" : p.subtipo_fabricacion === "ENSAMBLADO" ? "#6d28d9" : "#15803d",
                      }}>
                        {p.subtipo_fabricacion === "RECETA_BASE" ? "🧂 Base" : p.subtipo_fabricacion === "ENSAMBLADO" ? "🔧 Ensam." : "📦 Comp."}
                      </span>
                    )}
                    <span style={{
                      fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: 20,
                      background: p.totalInsumos > 0 ? "#dbeafe" : "#fef9c3",
                      color: p.totalInsumos > 0 ? "#1D4ED8" : "#92400e",
                    }}>
                      {p.totalInsumos > 0 ? `${p.totalInsumos} insumos` : "Sin receta"}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--erp-text-3)" }}>Rinde: {p.rendimiento} u.</span>
                  </div>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div style={{ padding: "0.75rem 1rem 1rem", background: "var(--erp-surface-1)", borderTop: "1px solid var(--erp-border)" }}>
                      {loadingRp[p.id] ? (
                        <div style={{ color: "var(--erp-text-3)", fontSize: 13 }}>Cargando…</div>
                      ) : (
                        <>
                          {items.length === 0 ? (
                            <div style={{ fontSize: "0.8rem", color: "var(--erp-text-3)", marginBottom: "0.75rem" }}>Sin insumos definidos. Agrega el primero abajo.</div>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0.75rem" }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid var(--erp-border)" }}>
                                  {["Insumo / Sub-receta", "Cant. neta", "Merma", "Cant. bruta", "Stock", ""].map((h, i) => (
                                    <th key={i} style={{ padding: "0.3rem 0.5rem", textAlign: i === 0 ? "left" : "right", fontSize: "0.68rem", fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item) => {
                                  const cantBruta = item.cantidad * (item.factorMerma ?? 1);
                                  const esFabricacion = item.insumoAprovisionamiento === "FABRICACION";
                                  return (
                                    <tr key={item.id} style={{ borderBottom: "1px solid var(--erp-border)" }}>
                                      <td style={{ padding: "0.35rem 0.5rem", fontSize: "0.85rem", color: "var(--erp-text-1)" }}>
                                        {esFabricacion && (
                                          <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: 20, background: item.insumoSubtipo === "RECETA_BASE" ? "#fef3c7" : "#ede9fe", color: item.insumoSubtipo === "RECETA_BASE" ? "#92400e" : "#6d28d9", marginRight: 4 }}>
                                            {item.insumoSubtipo === "RECETA_BASE" ? "🧂" : "🔧"}
                                          </span>
                                        )}
                                        {item.insumoNombre}
                                      </td>
                                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontSize: "0.85rem", color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{fmt(item.cantidad)} {item.insumoUnidad}</td>
                                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontSize: "0.8rem", color: item.factorMerma > 1 ? "#d97706" : "var(--erp-text-3)" }}>
                                        {item.factorMerma > 1 ? `+${fmt((item.factorMerma - 1) * 100, 1)}%` : "—"}
                                      </td>
                                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontSize: "0.8rem", color: item.factorMerma > 1 ? "#d97706" : "var(--erp-text-3)", fontVariantNumeric: "tabular-nums" }}>
                                        {item.factorMerma > 1 ? `${fmt(cantBruta)} ${item.insumoUnidad}` : "—"}
                                      </td>
                                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right", fontSize: "0.8rem", color: esFabricacion ? "#6d28d9" : item.stockInsumo > 0 ? "#15803d" : "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                                        {esFabricacion ? "sub-receta" : `${fmt(item.stockInsumo)} ${item.insumoUnidad}`}
                                      </td>
                                      <td style={{ padding: "0.35rem 0.5rem", textAlign: "right" }}>
                                        <button onClick={() => eliminarItem(p.id, item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontSize: "0.8rem" }} title="Eliminar">✕</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}

                          {/* Agregar insumo / sub-receta */}
                          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                            <select
                              value={ni?.insumoId ?? ""}
                              onChange={(e) => setNuevoItem((prev) => ({ ...prev, [p.id]: { ...prev[p.id] ?? { cantidad: "", factorMerma: "1", notas: "" }, insumoId: e.target.value } }))}
                              style={{ flex: "2 1 180px", padding: "0.4rem 0.6rem", fontSize: "0.8rem", border: "1px solid var(--erp-border)", borderRadius: 6, background: "var(--erp-surface-1)", color: "var(--erp-text-1)" }}
                            >
                              <option value="">— Insumo o sub-receta —</option>
                              {insumos.length > 0 && (
                                <optgroup label="🧂 Materias Primas">
                                  {insumos.map((ins) => (
                                    <option key={ins.id} value={ins.id}>{ins.nombre} ({ins.unidadMedida})</option>
                                  ))}
                                </optgroup>
                              )}
                              {productos.filter((pr) => pr.id !== p.id).length > 0 && (
                                <optgroup label="🔧 Sub-recetas / Ensamblados">
                                  {productos.filter((pr) => pr.id !== p.id).map((pr) => (
                                    <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            <input
                              type="number" min="0.001" step="0.001" placeholder="Cantidad"
                              value={ni?.cantidad ?? ""}
                              onChange={(e) => setNuevoItem((prev) => ({ ...prev, [p.id]: { ...prev[p.id] ?? { insumoId: "", factorMerma: "1", notas: "" }, cantidad: e.target.value } }))}
                              style={{ flex: "1 1 80px", padding: "0.4rem 0.6rem", fontSize: "0.8rem", border: "1px solid var(--erp-border)", borderRadius: 6, background: "var(--erp-surface-1)", color: "var(--erp-text-1)", textAlign: "right" }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              <label style={{ fontSize: "0.65rem", color: "var(--erp-text-3)" }}>Merma %</label>
                              <input
                                type="number" min="0" step="0.5" placeholder="0"
                                value={ni?.factorMerma && Number(ni.factorMerma) > 1 ? fmt((Number(ni.factorMerma) - 1) * 100, 1) : ""}
                                onChange={(e) => {
                                  const pct = Number(e.target.value) || 0;
                                  setNuevoItem((prev) => ({ ...prev, [p.id]: { ...prev[p.id] ?? { insumoId: "", cantidad: "", notas: "" }, factorMerma: String(1 + pct / 100) } }));
                                }}
                                style={{ width: 60, padding: "0.4rem 0.4rem", fontSize: "0.8rem", border: "1px solid var(--erp-border)", borderRadius: 6, background: "var(--erp-surface-1)", color: "var(--erp-text-1)", textAlign: "right" }}
                              />
                            </div>
                            <input
                              type="text" placeholder="Nota (opcional)"
                              value={ni?.notas ?? ""}
                              onChange={(e) => setNuevoItem((prev) => ({ ...prev, [p.id]: { ...prev[p.id] ?? { insumoId: "", cantidad: "", factorMerma: "1" }, notas: e.target.value } }))}
                              style={{ flex: "2 1 110px", padding: "0.4rem 0.6rem", fontSize: "0.8rem", border: "1px solid var(--erp-border)", borderRadius: 6, background: "var(--erp-surface-1)", color: "var(--erp-text-1)" }}
                            />
                            <button
                              onClick={() => agregarItem(p.id)}
                              disabled={guardandoItem[p.id] || !ni?.insumoId || !ni?.cantidad}
                              style={{ padding: "0.4rem 0.9rem", border: "none", borderRadius: 6, cursor: "pointer", background: "#1D4ED8", color: "#fff", fontSize: "0.8rem", fontWeight: 600, opacity: (!ni?.insumoId || !ni?.cantidad) ? 0.5 : 1 }}
                            >
                              {guardandoItem[p.id] ? "…" : "+ Agregar"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== TAB: SIMULAR ===== */}
      {tab === "simular" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: "2 1 200px" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase" }}>Producto a producir</label>
              <select
                value={simProductoId}
                onChange={(e) => { setSimProductoId(e.target.value); setSimResult(null); }}
                style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem", border: "1px solid var(--erp-border)", borderRadius: 8, background: "var(--erp-surface-1)", color: "var(--erp-text-1)" }}
              >
                <option value="">— Seleccionar producto —</option>
                {productos.filter(p => p.totalInsumos > 0).map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: "1 1 120px" }}>
              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase" }}>Cantidad a producir</label>
              <input
                type="number" min="1" step="1" value={simCantidad}
                onChange={(e) => { setSimCantidad(e.target.value); setSimResult(null); }}
                style={{ padding: "0.5rem 0.75rem", fontSize: "0.875rem", border: "1px solid var(--erp-border)", borderRadius: 8, background: "var(--erp-surface-1)", color: "var(--erp-text-1)", textAlign: "right" }}
              />
            </div>
            <button
              onClick={simular}
              disabled={simLoading || !simProductoId || !simCantidad}
              style={{ padding: "0.5rem 1.2rem", border: "none", borderRadius: 8, cursor: "pointer", background: "#1D4ED8", color: "#fff", fontSize: "0.875rem", fontWeight: 700, opacity: (!simProductoId || !simCantidad) ? 0.5 : 1 }}
            >
              {simLoading ? "Calculando…" : "🧪 Simular"}
            </button>
          </div>

          {simError && <div style={{ color: "#b91c1c", fontSize: 13 }}>{simError}</div>}

          {simResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Resumen */}
              <div style={{
                padding: "1rem 1.25rem", borderRadius: 10,
                background: simResult.puedeProducir ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${simResult.puedeProducir ? "#86efac" : "#fca5a5"}`,
                display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
              }}>
                <span style={{ fontSize: "1.5rem" }}>{simResult.puedeProducir ? "✅" : "❌"}</span>
                <div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: simResult.puedeProducir ? "#15803d" : "#b91c1c" }}>
                    {simResult.puedeProducir
                      ? `Puedes producir ${fmt(simResult.cantidadSolicitada)} unidades con el stock actual`
                      : `No hay stock suficiente para ${fmt(simResult.cantidadSolicitada)} unidades`}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--erp-text-3)", marginTop: 2 }}>
                    Máximo producible con stock actual: <strong>{fmt(simResult.maxProducible)} unidades</strong>
                  </div>
                </div>
              </div>

              {/* Tabla de necesidades */}
              <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 90px", background: "var(--erp-surface-2)", borderBottom: "1px solid var(--erp-border)" }}>
                  {["Insumo", "Necesario", "Disponible", "Déficit", "Estado"].map((h, i) => (
                    <span key={i} style={{ padding: "0.35rem 0.75rem", fontSize: "0.68rem", fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", textAlign: i === 0 ? "left" : "right" }}>{h}</span>
                  ))}
                </div>
                {simResult.necesidades.map((n, idx) => (
                  <div key={n.insumoId} style={{
                    display: "grid", gridTemplateColumns: "1fr 100px 100px 100px 90px",
                    alignItems: "center", padding: "0.5rem 0.75rem",
                    borderBottom: idx < simResult.necesidades.length - 1 ? "1px solid var(--erp-border)" : "none",
                    background: n.ok ? "var(--erp-surface-1)" : "#fef2f2",
                  }}>
                    <span style={{ fontSize: "0.875rem", color: "var(--erp-text-1)" }}>{n.nombre}</span>
                    <span style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{fmt(n.necesario)} {n.unidadMedida}</span>
                    <span style={{ textAlign: "right", fontSize: "0.8rem", color: n.disponible >= n.necesario ? "#15803d" : "#b91c1c", fontVariantNumeric: "tabular-nums" }}>{fmt(n.disponible)} {n.unidadMedida}</span>
                    <span style={{ textAlign: "right", fontSize: "0.8rem", fontWeight: n.deficit > 0 ? 700 : 400, color: n.deficit > 0 ? "#b91c1c" : "var(--erp-text-3)", fontVariantNumeric: "tabular-nums" }}>
                      {n.deficit > 0 ? `${fmt(n.deficit)} ${n.unidadMedida}` : "—"}
                    </span>
                    <span style={{ textAlign: "right", fontSize: "0.8rem" }}>
                      {n.ok ? <span style={{ color: "#15803d" }}>✓ OK</span> : <span style={{ color: "#b91c1c", fontWeight: 700 }}>⚠ Comprar</span>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Lista de compra */}
              {!simResult.puedeProducir && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "0.75rem 1rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem" }}>📋 Lista de compra sugerida</div>
                  {simResult.necesidades.filter((n) => !n.ok).map((n) => (
                    <div key={n.insumoId} style={{ fontSize: "0.85rem", color: "#78350f", display: "flex", justifyContent: "space-between", padding: "0.2rem 0" }}>
                      <span>{n.nombre}</span>
                      <strong>{fmt(n.deficit)} {n.unidadMedida}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!simResult && !simLoading && (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13, border: "1px dashed var(--erp-border)", borderRadius: 10 }}>
              Selecciona un producto y una cantidad para simular la producción
            </div>
          )}
        </div>
      )}
    </div>
  );
}

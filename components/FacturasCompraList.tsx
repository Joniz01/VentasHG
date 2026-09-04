"use client";

import { useEffect, useState } from "react";
import { formatFecha } from "@/lib/pedidos";
import FacturaCompraForm from "./FacturaCompraForm";

type Factura = {
  id: number; fecha: string; proveedorNombre: string; proveedorRif: string | null;
  numeroFactura: string | null; tasaDia: number; estado: string; tipoUso: "VENTA" | "MATERIA_PRIMA";
  totalBs: number; totalUsd: number;
};

type DetalleItem = {
  id: number; productoId: number | null; nombreProducto: string; cantidad: number; costoUnitBs: number; subtotalBs: number;
  tipoUso: "VENTA" | "MATERIA_PRIMA";
};

type Detalle = {
  id: number; fecha: string; proveedorNombre: string; proveedorRif: string | null;
  numeroFactura: string | null; observaciones: string | null; tasaDia: number;
  estado: string; tipoUso: "VENTA" | "MATERIA_PRIMA"; imagenFactura: string | null; items: DetalleItem[];
};

export default function FacturasCompraList({ puedeCrearProducto = false, tasaBcv = 0, isAdmin = false, puedeEliminarCompras = false }: { puedeCrearProducto?: boolean; tasaBcv?: number; isAdmin?: boolean; puedeEliminarCompras?: boolean }) {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editData, setEditData] = useState<Detalle | null>(null);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [proveedorQ, setProveedorQ] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<"TODAS" | "ACTIVA" | "ANULADA">("ACTIVA");
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [anulando, setAnulando] = useState(false);

  async function loadFacturas(estadoOverride?: "TODAS" | "ACTIVA" | "ANULADA") {
    setLoading(true); setError(null);
    const estadoEfectivo = estadoOverride ?? estadoFiltro;
    try {
      const params = new URLSearchParams();
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      if (proveedorQ) params.set("proveedor", proveedorQ);
      if (estadoEfectivo !== "TODAS") params.set("estado", estadoEfectivo);
      const res = await fetch(`/api/compras?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFacturas(data.items ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadFacturas("ACTIVA"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDetalle(id: number) {
    try {
      const res = await fetch(`/api/compras/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetalle(data);
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function handleEdit(id: number) {
    try {
      const res = await fetch(`/api/compras/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditData(data);
      setView("edit");
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  // KPI calculations from facturas array
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const facturasEsteMes = facturas.filter((f) => {
    const d = new Date(f.fecha);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && f.estado === "ACTIVA";
  });

  const kpiTotalBs = facturasEsteMes.reduce((acc, f) => acc + f.totalBs, 0);
  const kpiTotalUsd = facturasEsteMes.reduce((acc, f) => acc + f.totalUsd, 0);
  const kpiCount = facturasEsteMes.length;

  const kpiPorVencer = facturas.filter((f) => {
    if (f.estado !== "ACTIVA") return false;
    const fObj = f as Factura & { fecha_vencimiento_pago?: string };
    if (!fObj.fecha_vencimiento_pago) return false;
    const venc = new Date(fObj.fecha_vencimiento_pago);
    return venc >= now && venc <= sevenDaysLater;
  }).length;

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar esta factura anulada? Esta acción no se puede deshacer.")) return;
    try {
      const res = await fetch(`/api/compras/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetalle(null);
      loadFacturas();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
  }

  async function handleAnular(id: number) {
    if (!confirm("¿Anular esta factura? El inventario será revertido.")) return;
    setAnulando(true);
    try {
      const res = await fetch(`/api/compras/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "anular" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetalle(null);
      loadFacturas();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setAnulando(false); }
  }

  if (view === "new") {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => setView("list")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-2)", fontSize: 13 }}>← Volver</button>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-text)" }}>Nueva Factura de Compra</h2>
        </div>
        <FacturaCompraForm tasaBcv={tasaBcv} puedeCrearProducto={puedeCrearProducto} onCancel={() => setView("list")} onCreated={() => { setView("list"); loadFacturas(); }} />
      </div>
    );
  }

  if (view === "edit") {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => setView("list")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-2)", fontSize: 13 }}>← Volver</button>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-text)" }}>Editar Factura de Compra</h2>
        </div>
        <FacturaCompraForm tasaBcv={tasaBcv} puedeCrearProducto={puedeCrearProducto} initialData={editData ?? undefined} onCancel={() => setView("list")} onCreated={() => { setView("list"); loadFacturas(); }} onUpdated={() => { setView("list"); loadFacturas(); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--erp-text)" }}>Facturas de Compra</h2>
        <button type="button" onClick={() => setView("new")} style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Nueva Factura
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total mes actual (Bs)", value: `Bs ${kpiTotalBs.toFixed(2)}`, color: "var(--erp-primary)" },
          { label: "Total mes actual ($)", value: `$${kpiTotalUsd.toFixed(2)}`, color: "var(--erp-primary)" },
          { label: "Facturas este mes", value: String(kpiCount), color: "var(--erp-text)" },
          { label: "Por vencer (7 días)", value: String(kpiPorVencer), color: kpiPorVencer > 0 ? "#B45309" : "var(--erp-text)" },
        ].map((kpi) => (
          <div key={kpi.label} style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--erp-text-2)", marginBottom: 6, letterSpacing: "0.05em" }}>{kpi.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: kpi.color, fontVariantNumeric: "tabular-nums" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12 }} className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label style={{ color: "var(--erp-text-2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ border: "1px solid var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }} />
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ color: "var(--erp-text-2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ border: "1px solid var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }} />
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ color: "var(--erp-text-2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Proveedor</label>
          <input value={proveedorQ} onChange={(e) => setProveedorQ(e.target.value)} placeholder="Buscar..." style={{ border: "1px solid var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 13 }} />
        </div>
        <div className="flex flex-col gap-1">
          <label style={{ color: "var(--erp-text-2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Estado</label>
          <div style={{ display: "flex", border: "1px solid var(--erp-border)", borderRadius: 8, overflow: "hidden" }}>
            {(["TODAS", "ACTIVA", "ANULADA"] as const).map((op, i, arr) => (
              <button key={op} type="button" onClick={() => { setEstadoFiltro(op); loadFacturas(op); }}
                style={{
                  background: estadoFiltro === op ? "var(--erp-primary)" : "var(--erp-bg)",
                  color: estadoFiltro === op ? "#fff" : "var(--erp-text-2)",
                  border: "none", borderRight: i < arr.length - 1 ? "1px solid var(--erp-border)" : "none",
                  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {op === "TODAS" ? "Todas" : op === "ACTIVA" ? "Activa" : "Anulada"}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => loadFacturas()} disabled={loading} style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "..." : "Buscar"}
        </button>
      </div>

      {error && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{error}</div>}

      {/* Tabla */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["#", "Fecha", "Proveedor", "Factura", "Total Bs", "Total $", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: h === "Total Bs" || h === "Total $" ? "right" : h === "Estado" ? "center" : "left", color: "var(--erp-text-2)", fontWeight: 600, borderBottom: "1px solid var(--erp-border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</td></tr>}
              {!loading && facturas.length === 0 && <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>No hay facturas registradas</td></tr>}
              {!loading && facturas.map((f, idx) => (
                <tr key={f.id} style={{ borderBottom: idx < facturas.length - 1 ? "1px solid var(--erp-border)" : "none", opacity: f.estado === "ANULADA" ? 0.5 : 1 }}>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--erp-primary)" }}>#{f.id}</td>
                  <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{formatFecha(f.fecha)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--erp-text)" }}>{f.proveedorNombre}</td>
                  <td style={{ padding: "10px 14px", color: "var(--erp-text-2)" }}>{f.numeroFactura ?? "-"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--erp-text)" }}>Bs {f.totalBs.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--erp-text-2)" }}>${f.totalUsd.toFixed(2)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <span style={{ background: f.estado === "ACTIVA" ? "#DCFCE7" : "#FEF2F2", color: f.estado === "ACTIVA" ? "#166534" : "#B91C1C", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{f.estado}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => loadDetalle(f.id)} style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--erp-text-2)" }}>Ver</button>
                      {f.estado === "ACTIVA" && (
                        <button type="button" onClick={() => handleEdit(f.id)} style={{ background: "none", border: "1px solid var(--erp-primary)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--erp-primary)" }}>Editar</button>
                      )}
                      {puedeEliminarCompras && f.estado === "ANULADA" && (
                        <button type="button" onClick={() => handleEliminar(f.id)} style={{ background: "none", border: "1px solid #B91C1C", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "#B91C1C" }}>Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto" }} onClick={() => setDetalle(null)}>
          <div style={{ background: "var(--erp-surface)", borderRadius: 16, width: "100%", maxWidth: 540, marginTop: 40 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--erp-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, color: "var(--erp-text)", fontSize: 15 }}>Factura #{detalle.id}</span>
                  <span style={{
                    background: detalle.tipoUso === "MATERIA_PRIMA" ? "#FEF3C7" : "#DCFCE7",
                    color: detalle.tipoUso === "MATERIA_PRIMA" ? "#92400E" : "#166534",
                    borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700,
                  }}>
                    {detalle.tipoUso === "MATERIA_PRIMA" ? "Materia prima" : "Para venta"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--erp-text-3)" }}>{formatFecha(detalle.fecha)} · {detalle.proveedorNombre}</div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && detalle.estado === "ACTIVA" && (
                  <button type="button" onClick={() => handleAnular(detalle.id)} disabled={anulando} style={{ background: "#FEF2F2", color: "#B91C1C", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {anulando ? "..." : "Anular"}
                  </button>
                )}
                {puedeEliminarCompras && detalle.estado === "ANULADA" && (
                  <button type="button" onClick={() => handleEliminar(detalle.id)} style={{ background: "#7F1D1D", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Eliminar
                  </button>
                )}
                <button type="button" onClick={() => setDetalle(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)", fontSize: 20 }}>✕</button>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              {detalle.numeroFactura && <div style={{ fontSize: 13, color: "var(--erp-text-2)", marginBottom: 12 }}>N° Factura: <strong>{detalle.numeroFactura}</strong></div>}
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "var(--erp-bg)" }}>
                  {["Producto", "Cant.", "Costo Bs", "Tipo", "Subtotal"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: h === "Cant." || h === "Tipo" ? "center" : h !== "Producto" ? "right" : "left", color: "var(--erp-text-2)", fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {detalle.items.map((it) => (
                    <tr key={it.id} style={{ borderTop: "1px solid var(--erp-border)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--erp-text)" }}>{it.nombreProducto}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", color: "var(--erp-text-2)" }}>{it.cantidad}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--erp-text-2)" }}>{it.costoUnitBs.toFixed(2)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        <span style={{
                          background: it.tipoUso === "MATERIA_PRIMA" ? "#FEF3C7" : "#DCFCE7",
                          color: it.tipoUso === "MATERIA_PRIMA" ? "#92400E" : "#166534",
                          borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                        }}>
                          {it.tipoUso === "MATERIA_PRIMA" ? "M.P." : "Venta"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "var(--erp-text)" }}>{it.subtotalBs.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detalle.imagenFactura && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", marginBottom: 6 }}>IMAGEN FACTURA</div>
                  <img src={detalle.imagenFactura.startsWith("data:") ? detalle.imagenFactura : `data:image/jpeg;base64,${detalle.imagenFactura}`} alt="Factura" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--erp-border)" }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

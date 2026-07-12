"use client";

import { useState, useRef, useEffect } from "react";

type ProveedorSug = { id: number; nombre: string };
type ProductoSug = { id: number; nombre: string };

type ItemLine = {
  key: number;
  productoId: number | null;
  nombreProducto: string;
  cantidad: string;
  costoUnitBs: string;
};

type Recepcion = {
  id: number;
  fecha: string;
  proveedorNombre: string;
  itemsCount: number;
  estado: "PENDIENTE" | "RELACIONADA";
  compraId: number | null;
};

type DetalleItem = {
  id: number;
  nombreProducto: string;
  cantidad: number;
  costoUnitBs: number | null;
};

type Detalle = {
  id: number;
  fecha: string;
  proveedorNombre: string;
  observaciones: string | null;
  estado: "PENDIENTE" | "RELACIONADA";
  compraId: number | null;
  items: DetalleItem[];
};

type Compra = { id: number; proveedorNombre: string; fecha: string; numeroFactura: string | null };

let keySeq = 0;
function nextKey() { return ++keySeq; }

function formatFecha(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

const inp: React.CSSProperties = {
  border: "1px solid var(--erp-border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  background: "var(--erp-bg)",
  color: "var(--erp-text)",
  width: "100%",
  boxSizing: "border-box",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--erp-text-2)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 10,
};

const card: React.CSSProperties = {
  background: "var(--erp-surface)",
  border: "1px solid var(--erp-border)",
  borderRadius: 12,
  padding: 16,
};

export default function RecepcionPanel() {
  type View = "list" | "new";
  const [view, setView] = useState<View>("list");
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "relacionadas">("todos");

  // ── List state ──────────────────────────────────────────────────────────────
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // ── Detail modal state ──────────────────────────────────────────────────────
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [comprasLoading, setComprasLoading] = useState(false);
  const [selectedCompraId, setSelectedCompraId] = useState<string>("");
  const [relacionando, setRelacionando] = useState(false);
  const [relacionarError, setRelacionarError] = useState<string | null>(null);
  const [showRelacionar, setShowRelacionar] = useState(false);

  // ── New form state ──────────────────────────────────────────────────────────
  const [proveedorQ, setProveedorQ] = useState("");
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [provSugs, setProvSugs] = useState<ProveedorSug[]>([]);
  const [showProvSugs, setShowProvSugs] = useState(false);
  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [items, setItems] = useState<ItemLine[]>([
    { key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "" },
  ]);
  const [prodSugs, setProdSugs] = useState<Record<number, ProductoSug[]>>({});
  const [showProdSugs, setShowProdSugs] = useState<Record<number, boolean>>({});
  const prodTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Load list ───────────────────────────────────────────────────────────────
  async function loadRecepciones() {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/recepciones");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar recepciones");
      setRecepciones(data.items ?? []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRecepciones(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load detail ─────────────────────────────────────────────────────────────
  async function loadDetalle(id: number) {
    setDetalleLoading(true);
    setShowRelacionar(false);
    setRelacionarError(null);
    setSelectedCompraId("");
    try {
      const res = await fetch(`/api/recepciones/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setDetalle(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Error");
    } finally {
      setDetalleLoading(false);
    }
  }

  // ── Load compras for linking ─────────────────────────────────────────────────
  async function loadCompras() {
    setComprasLoading(true);
    try {
      const res = await fetch("/api/compras");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setCompras(data.items ?? []);
    } catch {
      // non-critical
    } finally {
      setComprasLoading(false);
    }
  }

  function openRelacionar() {
    setShowRelacionar(true);
    setRelacionarError(null);
    setSelectedCompraId("");
    loadCompras();
  }

  async function handleRelacionar() {
    if (!detalle || !selectedCompraId) return;
    setRelacionando(true);
    setRelacionarError(null);
    try {
      const res = await fetch(`/api/recepciones/${detalle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compraId: Number(selectedCompraId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al relacionar");
      setDetalle(null);
      loadRecepciones();
    } catch (err) {
      setRelacionarError(err instanceof Error ? err.message : "Error");
    } finally {
      setRelacionando(false);
    }
  }

  // ── Proveedor autocomplete ──────────────────────────────────────────────────
  function onProveedorInput(val: string) {
    setProveedorQ(val);
    setProveedorId(null);
    if (provTimer.current) clearTimeout(provTimer.current);
    if (!val.trim()) { setProvSugs([]); setShowProvSugs(false); return; }
    provTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/proveedores?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        setProvSugs((d.items ?? []).map((p: { id: number; nombre: string }) => ({ id: p.id, nombre: p.nombre })));
        setShowProvSugs(true);
      } catch { /* ignore */ }
    }, 300);
  }

  function selectProveedor(p: ProveedorSug) {
    setProveedorQ(p.nombre);
    setProveedorId(p.id);
    setProvSugs([]);
    setShowProvSugs(false);
  }

  // ── Producto autocomplete ───────────────────────────────────────────────────
  function onProductoInput(key: number, val: string) {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, nombreProducto: val, productoId: null } : it));
    if (prodTimers.current[key]) clearTimeout(prodTimers.current[key]);
    if (!val.trim()) {
      setProdSugs((p) => ({ ...p, [key]: [] }));
      setShowProdSugs((p) => ({ ...p, [key]: false }));
      return;
    }
    prodTimers.current[key] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/productos?q=${encodeURIComponent(val)}&limit=8`);
        const d = await r.json();
        setProdSugs((p) => ({ ...p, [key]: d.productos ?? [] }));
        setShowProdSugs((p) => ({ ...p, [key]: true }));
      } catch { /* ignore */ }
    }, 300);
  }

  function selectProducto(key: number, p: ProductoSug) {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, productoId: p.id, nombreProducto: p.nombre } : it));
    setProdSugs((s) => ({ ...s, [key]: [] }));
    setShowProdSugs((s) => ({ ...s, [key]: false }));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "" },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function updateItem(key: number, field: "cantidad" | "costoUnitBs", val: string) {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, [field]: val } : it));
  }

  function resetForm() {
    setProveedorQ("");
    setProveedorId(null);
    setProvSugs([]);
    setShowProvSugs(false);
    setItems([{ key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "" }]);
    setProdSugs({});
    setShowProdSugs({});
    setObservaciones("");
    setSaveError(null);
  }

  async function handleGuardar() {
    if (!proveedorQ.trim()) { setSaveError("El proveedor es requerido"); return; }
    const validItems = items.filter((it) => it.nombreProducto.trim() && Number(it.cantidad) > 0);
    if (!validItems.length) { setSaveError("Debe agregar al menos un ítem"); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/recepciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId,
          proveedorNombre: proveedorQ.trim(),
          observaciones: observaciones.trim() || null,
          items: validItems.map((it) => ({
            productoId: it.productoId,
            nombreProducto: it.nombreProducto.trim(),
            cantidad: Number(it.cantidad),
            costoUnitBs: it.costoUnitBs ? Number(it.costoUnitBs) : null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      resetForm();
      setView("list");
      loadRecepciones();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = recepciones.filter((r) => {
    if (filtro === "pendientes") return r.estado === "PENDIENTE";
    if (filtro === "relacionadas") return r.estado === "RELACIONADA";
    return true;
  });

  const chipBase: React.CSSProperties = {
    border: "1px solid var(--erp-border)",
    borderRadius: 999,
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    background: "none",
    color: "var(--erp-text-2)",
    transition: "background 0.15s, color 0.15s",
  };

  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: "var(--erp-primary)",
    color: "#fff",
    border: "1px solid var(--erp-primary)",
  };

  function estadoBadge(estado: "PENDIENTE" | "RELACIONADA") {
    const isPending = estado === "PENDIENTE";
    return (
      <span
        style={{
          background: isPending ? "#FEF9C3" : "#DCFCE7",
          color: isPending ? "#92400E" : "#166534",
          borderRadius: 999,
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.03em",
        }}
      >
        {estado}
      </span>
    );
  }

  // ── NEW FORM VIEW ────────────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <div className="flex flex-col gap-5" style={{ maxWidth: 700 }}>
        {/* Back + title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { resetForm(); setView("list"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-2)", fontSize: 13 }}
          >
            ← Volver
          </button>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-text)" }}>Nueva Recepción de Mercancía</h2>
        </div>

        {/* Proveedor */}
        <div style={card}>
          <div style={sectionLabel}>Proveedor</div>
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Nombre *</label>
            <input
              value={proveedorQ}
              onChange={(e) => onProveedorInput(e.target.value)}
              onBlur={() => setTimeout(() => setShowProvSugs(false), 200)}
              placeholder="Buscar o escribir proveedor..."
              style={inp}
            />
            {showProvSugs && provSugs.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--erp-surface)",
                  border: "1px solid var(--erp-border)",
                  borderRadius: 8,
                  zIndex: 50,
                  maxHeight: 180,
                  overflowY: "auto",
                  boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                }}
              >
                {provSugs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => selectProveedor(p)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 12px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--erp-text)",
                      borderBottom: "1px solid var(--erp-border)",
                    }}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div style={card}>
          <div style={sectionLabel}>Ítems recibidos</div>
          <div className="flex flex-col gap-2">
            {items.map((it, idx) => (
              <div key={it.key} className="flex gap-2 items-start">
                {/* Producto */}
                <div style={{ flex: 2, position: "relative" }}>
                  {idx === 0 && (
                    <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>PRODUCTO</label>
                  )}
                  <input
                    value={it.nombreProducto}
                    onChange={(e) => onProductoInput(it.key, e.target.value)}
                    onBlur={() => setTimeout(() => setShowProdSugs((p) => ({ ...p, [it.key]: false })), 200)}
                    placeholder="Buscar producto..."
                    style={inp}
                  />
                  {showProdSugs[it.key] && (prodSugs[it.key] ?? []).length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        background: "var(--erp-surface)",
                        border: "1px solid var(--erp-border)",
                        borderRadius: 8,
                        zIndex: 50,
                        maxHeight: 160,
                        overflowY: "auto",
                        boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                      }}
                    >
                      {(prodSugs[it.key] ?? []).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => selectProducto(it.key, p)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 12px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--erp-text)",
                            borderBottom: "1px solid var(--erp-border)",
                          }}
                        >
                          {p.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cantidad */}
                <div style={{ width: 80 }}>
                  {idx === 0 && (
                    <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>CANT.</label>
                  )}
                  <input
                    type="number"
                    value={it.cantidad}
                    min="0.01"
                    step="0.01"
                    onChange={(e) => updateItem(it.key, "cantidad", e.target.value)}
                    style={{ ...inp, textAlign: "right" }}
                  />
                </div>

                {/* Costo */}
                <div style={{ width: 110 }}>
                  {idx === 0 && (
                    <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>COSTO Bs</label>
                  )}
                  <input
                    type="number"
                    value={it.costoUnitBs}
                    min="0"
                    step="0.01"
                    onChange={(e) => updateItem(it.key, "costoUnitBs", e.target.value)}
                    placeholder="0.00"
                    style={{ ...inp, textAlign: "right" }}
                  />
                </div>

                {/* Remove */}
                <div style={{ paddingTop: idx === 0 ? 20 : 0 }}>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    disabled={items.length === 1}
                    style={{
                      background: "none",
                      border: "1px solid var(--erp-border)",
                      borderRadius: 6,
                      width: 32,
                      height: 32,
                      cursor: items.length === 1 ? "not-allowed" : "pointer",
                      color: "var(--erp-text-3)",
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: items.length === 1 ? 0.4 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              style={{
                alignSelf: "flex-start",
                background: "none",
                border: "1px dashed var(--erp-border)",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
                color: "var(--erp-primary)",
                cursor: "pointer",
                fontWeight: 600,
                marginTop: 4,
              }}
            >
              + Agregar ítem
            </button>
          </div>
        </div>

        {/* Observaciones */}
        <div style={card}>
          <div style={sectionLabel}>Observaciones</div>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Opcional — estado de la mercancía, condiciones de entrega, etc."
            rows={3}
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {saveError && (
          <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
            {saveError}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => { resetForm(); setView("list"); }}
            style={{
              background: "none",
              border: "1px solid var(--erp-border)",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 13,
              cursor: "pointer",
              color: "var(--erp-text-2)",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={saving}
            style={{
              background: "var(--erp-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 24px",
              fontSize: 13,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--erp-text)" }}>Recepciones de Mercancía</h2>
        <button
          type="button"
          onClick={() => setView("new")}
          style={{
            background: "var(--erp-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Nueva Recepción
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(["todos", "pendientes", "relacionadas"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            style={filtro === f ? chipActive : chipBase}
          >
            {f === "todos" ? "Todos" : f === "pendientes" ? "Pendientes" : "Relacionadas"}
          </button>
        ))}
      </div>

      {listError && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
          {listError}
        </div>
      )}

      {/* Table */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["Fecha", "Proveedor", "Ítems", "Estado", "Compra #", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: h === "Ítems" ? "center" : "left",
                      color: "var(--erp-text-2)",
                      fontWeight: 600,
                      borderBottom: "1px solid var(--erp-border)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--erp-text-3)" }}>
                    No hay recepciones registradas
                  </td>
                </tr>
              )}
              {!loading && filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--erp-border)" : "none" }}
                >
                  <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                    {formatFecha(r.fecha)}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--erp-text)" }}>
                    {r.proveedorNombre}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>
                    {r.itemsCount}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {estadoBadge(r.estado)}
                  </td>
                  <td style={{ padding: "10px 14px", color: r.compraId ? "var(--erp-primary)" : "var(--erp-text-3)", fontWeight: r.compraId ? 700 : 400 }}>
                    {r.compraId ? `#${r.compraId}` : "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      type="button"
                      onClick={() => loadDetalle(r.id)}
                      style={{
                        background: "none",
                        border: "1px solid var(--erp-border)",
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 12,
                        cursor: "pointer",
                        color: "var(--erp-text-2)",
                      }}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {(detalle || detalleLoading) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
          onClick={() => { setDetalle(null); setShowRelacionar(false); }}
        >
          <div
            style={{
              background: "var(--erp-surface)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 540,
              marginTop: 40,
              marginBottom: 40,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {detalleLoading && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
                Cargando...
              </div>
            )}

            {!detalleLoading && detalle && (
              <>
                {/* Modal header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--erp-border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--erp-text)", fontSize: 15 }}>
                      Recepción #{detalle.id}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--erp-text-3)", marginTop: 2 }}>
                      {formatFecha(detalle.fecha)} · {detalle.proveedorNombre}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {estadoBadge(detalle.estado)}
                    <button
                      type="button"
                      onClick={() => { setDetalle(null); setShowRelacionar(false); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)", fontSize: 20, lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Modal body */}
                <div style={{ padding: 20 }}>
                  {/* Items table */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--erp-bg)" }}>
                          {["Producto", "Cant.", "Costo Bs"].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "8px 10px",
                                textAlign: h !== "Producto" ? "right" : "left",
                                color: "var(--erp-text-2)",
                                fontWeight: 600,
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.items.map((it) => (
                          <tr key={it.id} style={{ borderTop: "1px solid var(--erp-border)" }}>
                            <td style={{ padding: "8px 10px", color: "var(--erp-text)" }}>{it.nombreProducto}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>
                              {it.cantidad}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>
                              {it.costoUnitBs != null ? `Bs ${it.costoUnitBs.toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {detalle.observaciones && (
                    <div
                      style={{
                        marginTop: 14,
                        background: "var(--erp-bg)",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 13,
                        color: "var(--erp-text-2)",
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--erp-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Observaciones: </span>
                      {detalle.observaciones}
                    </div>
                  )}

                  {detalle.compraId && (
                    <div style={{ marginTop: 14, fontSize: 13, color: "var(--erp-text-2)" }}>
                      Relacionada con compra{" "}
                      <strong style={{ color: "var(--erp-primary)" }}>#{detalle.compraId}</strong>
                    </div>
                  )}

                  {/* Relacionar section */}
                  {detalle.estado === "PENDIENTE" && !showRelacionar && (
                    <div style={{ marginTop: 20, borderTop: "1px solid var(--erp-border)", paddingTop: 16 }}>
                      <button
                        type="button"
                        onClick={openRelacionar}
                        style={{
                          background: "var(--erp-primary-lt)",
                          color: "var(--erp-primary)",
                          border: "1px solid var(--erp-primary)",
                          borderRadius: 8,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Relacionar con factura
                      </button>
                    </div>
                  )}

                  {detalle.estado === "PENDIENTE" && showRelacionar && (
                    <div style={{ marginTop: 20, borderTop: "1px solid var(--erp-border)", paddingTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        Seleccionar factura de compra
                      </div>
                      {comprasLoading ? (
                        <div style={{ fontSize: 13, color: "var(--erp-text-3)" }}>Cargando compras...</div>
                      ) : (
                        <select
                          value={selectedCompraId}
                          onChange={(e) => setSelectedCompraId(e.target.value)}
                          style={{
                            ...inp,
                            width: "100%",
                            marginBottom: 10,
                            cursor: "pointer",
                          }}
                        >
                          <option value="">— Seleccionar compra activa —</option>
                          {compras.map((c) => (
                            <option key={c.id} value={c.id}>
                              #{c.id} · {c.proveedorNombre}
                              {c.numeroFactura ? ` · Fact. ${c.numeroFactura}` : ""}
                              {" · "}
                              {formatFecha(c.fecha)}
                            </option>
                          ))}
                        </select>
                      )}

                      {relacionarError && (
                        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>
                          {relacionarError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowRelacionar(false); setRelacionarError(null); }}
                          style={{
                            background: "none",
                            border: "1px solid var(--erp-border)",
                            borderRadius: 8,
                            padding: "7px 16px",
                            fontSize: 13,
                            cursor: "pointer",
                            color: "var(--erp-text-2)",
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleRelacionar}
                          disabled={relacionando || !selectedCompraId}
                          style={{
                            background: "var(--erp-primary)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "7px 20px",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: relacionando || !selectedCompraId ? "not-allowed" : "pointer",
                            opacity: relacionando || !selectedCompraId ? 0.6 : 1,
                          }}
                        >
                          {relacionando ? "Guardando..." : "Confirmar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

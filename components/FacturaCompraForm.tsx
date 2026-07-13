"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type ItemLine = {
  key: number;
  productoId: number | null;
  nombreProducto: string;
  cantidad: string;
  costoUnitBs: string;
  // mini-form para producto nuevo
  showCreate?: boolean;
  categoriaId?: number | null;
  paraVenta?: boolean; // false = materia prima
};

type ProductoSug = { id: number; nombre: string; stockActual: number };
type ProveedorSug = { id: number; nombre: string; rif: string | null; telefono: string | null; direccion: string | null; diasCredito: number };
type Categoria = { id: number; nombre: string };

type FacturaDetalle = {
  id: number;
  fecha: string;
  proveedorId?: number | null;
  proveedorNombre: string;
  proveedorRif?: string | null;
  numeroFactura?: string | null;
  observaciones?: string | null;
  tasaDia: number;
  fechaVencimientoPago?: string | null;
  items: { id?: number; productoId: number | null; nombreProducto: string; cantidad: number; costoUnitBs: number }[];
  imagenFactura?: string | null;
};

let keySeq = 0;
function nextKey() { return ++keySeq; }

const inpStyle: React.CSSProperties = {
  border: "1px solid var(--erp-border)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", width: "100%",
};

const STEPS = ["Proveedor", "Productos", "Factura"];

export default function FacturaCompraForm({
  tasaBcv, puedeCrearProducto, onCancel, onCreated, initialData, onUpdated,
}: {
  tasaBcv: number;
  puedeCrearProducto: boolean;
  onCancel: () => void;
  onCreated: () => void;
  initialData?: FacturaDetalle;
  onUpdated?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!initialData;
  const [step, setStep] = useState(0);

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  useEffect(() => {
    fetch("/api/categorias").then(r => r.json()).then(d => setCategorias(d ?? [])).catch(() => {});
  }, []);

  // ── Proveedor ──────────────────────────────────────────────────────────────
  const [proveedorQ, setProveedorQ] = useState(initialData?.proveedorNombre ?? "");
  const [proveedorId, setProveedorId] = useState<number | null>(initialData?.proveedorId ?? null);
  const [proveedorRif, setProveedorRif] = useState(initialData?.proveedorRif ?? "");
  const [proveedorTel, setProveedorTel] = useState("");
  const [proveedorDir, setProveedorDir] = useState("");
  const [proveedorDiasCredito, setProveedorDiasCredito] = useState(0);
  const [provSugs, setProvSugs] = useState<ProveedorSug[]>([]);
  const [showProvSugs, setShowProvSugs] = useState(false);
  const [provSearched, setProvSearched] = useState(false);
  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Productos ──────────────────────────────────────────────────────────────
  const [items, setItems] = useState<ItemLine[]>(
    initialData?.items?.length
      ? initialData.items.map(it => ({ key: nextKey(), productoId: it.productoId, nombreProducto: it.nombreProducto, cantidad: String(it.cantidad), costoUnitBs: String(it.costoUnitBs), paraVenta: true }))
      : [{ key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "", paraVenta: true }]
  );
  const [prodSugs, setProdSugs] = useState<Record<number, ProductoSug[]>>({});
  const [showProdSugs, setShowProdSugs] = useState<Record<number, boolean>>({});
  const prodTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // ── Factura ────────────────────────────────────────────────────────────────
  const [fecha, setFecha] = useState(initialData?.fecha?.slice(0, 10) ?? today);
  const [numeroFactura, setNumeroFactura] = useState(initialData?.numeroFactura ?? "");
  const [observaciones, setObservaciones] = useState(initialData?.observaciones ?? "");
  const [tasaDia, setTasaDia] = useState(initialData ? String(initialData.tasaDia) : (tasaBcv > 0 ? String(tasaBcv) : ""));
  const [fechaVencimientoPago, setFechaVencimientoPago] = useState(initialData?.fechaVencimientoPago?.slice(0, 10) ?? "");
  const [imagenBase64, setImagenBase64] = useState<string | null>(initialData?.imagenFactura ?? null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Helpers proveedor ──────────────────────────────────────────────────────
  function applyProveedor(p: ProveedorSug) {
    setProveedorQ(p.nombre); setProveedorId(p.id);
    setProveedorRif(p.rif ?? ""); setProveedorTel(p.telefono ?? "");
    setProveedorDir(p.direccion ?? ""); setProveedorDiasCredito(p.diasCredito ?? 0);
    setProvSugs([]); setShowProvSugs(false); setProvSearched(false);
    if ((p.diasCredito ?? 0) > 0) {
      const d = new Date(fecha || today);
      d.setDate(d.getDate() + p.diasCredito);
      setFechaVencimientoPago(d.toISOString().slice(0, 10));
    }
  }

  function onProveedorInput(val: string) {
    setProveedorQ(val); setProveedorId(null); setProvSearched(false);
    if (provTimer.current) clearTimeout(provTimer.current);
    if (!val.trim()) { setProvSugs([]); setShowProvSugs(false); return; }
    provTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/proveedores?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        const list = (d.items ?? []).map((p: { id: number; nombre: string; rifCi: string | null; telefono: string | null; direccion: string | null; diasCredito: number }) =>
          ({ id: p.id, nombre: p.nombre, rif: p.rifCi, telefono: p.telefono, direccion: p.direccion, diasCredito: p.diasCredito ?? 0 }));
        setProvSugs(list); setShowProvSugs(true); setProvSearched(true);
      } catch { /* ignore */ }
    }, 300);
  }

  // ── Helpers productos ──────────────────────────────────────────────────────
  function onProductoInput(key: number, val: string) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, nombreProducto: val, productoId: null, showCreate: false } : it));
    if (prodTimers.current[key]) clearTimeout(prodTimers.current[key]);
    if (!val.trim()) { setProdSugs(p => ({ ...p, [key]: [] })); setShowProdSugs(p => ({ ...p, [key]: false })); return; }
    prodTimers.current[key] = setTimeout(async () => {
      try {
        const r = await fetch(`/api/productos?q=${encodeURIComponent(val)}&limit=8`);
        const d = await r.json();
        setProdSugs(p => ({ ...p, [key]: d.productos ?? [] }));
        setShowProdSugs(p => ({ ...p, [key]: true }));
      } catch { /* ignore */ }
    }, 300);
  }

  function selectProducto(key: number, p: ProductoSug) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, productoId: p.id, nombreProducto: p.nombre, showCreate: false } : it));
    setProdSugs(s => ({ ...s, [key]: [] }));
    setShowProdSugs(s => ({ ...s, [key]: false }));
  }

  function toggleCreateProd(key: number) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, showCreate: !it.showCreate } : it));
    setShowProdSugs(p => ({ ...p, [key]: false }));
  }

  // ── OCR ────────────────────────────────────────────────────────────────────
  const compressImage = (file: File): Promise<{ dataUrl: string; base64: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = e => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ dataUrl, base64: dataUrl.split(",")[1] });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  const handleImageFile = useCallback(async (file: File) => {
    try {
      const { dataUrl, base64 } = await compressImage(file);
      setImagenBase64(dataUrl); setOcrError(null); setOcrLoading(true);
      try {
        const res = await fetch("/api/compras/ocr", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenBase64: base64, mimeType: "image/jpeg" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const d = data.data ?? {};

        const ocrNombre = typeof d.proveedor === "string" ? d.proveedor : (d.proveedor?.nombre ?? "");
        const ocrRif = typeof d.proveedor === "object" ? (d.proveedor?.rif ?? "") : "";
        const ocrDir = typeof d.proveedor === "object" ? (d.proveedor?.direccion ?? "") : "";
        let encontrado = false;
        if (ocrRif) {
          try {
            const pr = await fetch(`/api/proveedores?rif=${encodeURIComponent(ocrRif)}`);
            const pd = await pr.json();
            const match = (pd.items ?? [])[0];
            if (match) { applyProveedor({ ...match, rif: match.rifCi, diasCredito: match.diasCredito ?? 0 }); encontrado = true; }
          } catch { /* ignore */ }
        }
        if (!encontrado && ocrNombre) {
          try {
            const pr = await fetch(`/api/proveedores?q=${encodeURIComponent(ocrNombre)}`);
            const pd = await pr.json();
            const list = pd.items ?? [];
            const exact = list.find((p: { nombre: string }) => p.nombre.toLowerCase() === ocrNombre.toLowerCase()) ?? list[0];
            if (exact) { applyProveedor({ ...exact, rif: exact.rifCi, diasCredito: exact.diasCredito ?? 0 }); encontrado = true; }
          } catch { /* ignore */ }
        }
        if (!encontrado) {
          if (ocrNombre) setProveedorQ(ocrNombre);
          if (ocrRif) setProveedorRif(ocrRif);
          if (ocrDir) setProveedorDir(ocrDir);
        }
        if (d.numero_factura) setNumeroFactura(String(d.numero_factura));
        if (d.fecha) setFecha(String(d.fecha).slice(0, 10));
        if (Array.isArray(d.items) && d.items.length > 0) {
          setItems(d.items.map((it: { nombre?: string; cantidad?: number; costo_unitario_bs?: number; costo?: number }) => ({
            key: nextKey(), productoId: null,
            nombreProducto: it.nombre ?? "",
            cantidad: String(it.cantidad ?? 1),
            costoUnitBs: String(it.costo_unitario_bs ?? it.costo ?? ""),
            paraVenta: true,
          })));
        }
      } catch (err) { setOcrError(err instanceof Error ? err.message : "Error OCR"); }
      finally { setOcrLoading(false); }
    } catch (err) { setOcrError(err instanceof Error ? err.message : "Error al procesar imagen"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const validItems = items.filter(it => it.nombreProducto.trim() && Number(it.cantidad) > 0);
    if (!validItems.length) { setSaveError("Debe agregar al menos un ítem"); return; }
    setSaving(true); setSaveError(null);
    try {
      // 1. Crear proveedor si no tiene ID
      let finalProveedorId = proveedorId;
      if (!finalProveedorId && proveedorQ.trim()) {
        const rp = await fetch("/api/proveedores", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: proveedorQ.trim(), rifCi: proveedorRif.trim() || null, direccion: proveedorDir.trim() || null, telefono: proveedorTel.trim() || null, diasCredito: proveedorDiasCredito || 0 }),
        });
        const rd = await rp.json();
        if (!rp.ok) throw new Error(`Error al crear proveedor: ${rd.error}`);
        finalProveedorId = rd.id;
      }

      // 2. Crear productos faltantes si tiene permiso
      const resolvedItems = await Promise.all(validItems.map(async it => {
        if (it.productoId) return it;
        if (!puedeCrearProducto || !it.showCreate) return it;
        try {
          const rp = await fetch("/api/productos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre: it.nombreProducto.trim(),
              costo: Number(it.costoUnitBs) || 0,
              precioVenta: it.paraVenta ? Number(it.costoUnitBs) || 0 : 0,
              categoriaId: it.categoriaId || null,
              tipoProducto: "NORMAL",
              stockActual: 0, stockMinimo: 0,
            }),
          });
          const rd = await rp.json();
          if (rp.ok && rd.id) return { ...it, productoId: rd.id };
        } catch { /* guardar sin ID */ }
        return it;
      }));

      // 3. Registrar factura
      const url = isEdit ? `/api/compras/${initialData!.id}` : "/api/compras";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha, proveedorId: finalProveedorId,
          proveedorNombre: proveedorQ.trim(),
          proveedorRif: proveedorRif.trim() || null,
          numeroFactura: numeroFactura.trim() || null,
          observaciones: observaciones.trim() || null,
          tasaDia: Number(tasaDia) || 0,
          fechaVencimientoPago: fechaVencimientoPago || null,
          imagenFactura: imagenBase64,
          items: resolvedItems.map(it => ({
            productoId: it.productoId,
            nombreProducto: it.nombreProducto.trim(),
            cantidad: Number(it.cantidad),
            costoUnitBs: Number(it.costoUnitBs),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (isEdit) { onUpdated?.(); } else { onCreated(); }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  const totalBs = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0), 0);
  const tasa = Number(tasaDia) || 0;
  const totalUsd = tasa > 0 ? totalBs / tasa : 0;
  const provConfirmado = !!proveedorId;
  const provNuevo = proveedorQ.trim() && !proveedorId;

  // ── Sección productos (compartida entre wizard paso 1 y form plano) ─────────
  function renderProductos() {
    return (
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Productos</div>
        <div className="flex flex-col gap-3">
          {items.map((it, idx) => {
            const sinId = it.nombreProducto.trim() && !it.productoId;
            return (
              <div key={it.key}>
                <div className="flex gap-2 items-start">
                  <div style={{ flex: 2, position: "relative" }}>
                    {idx === 0 && <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>PRODUCTO</label>}
                    <input
                      value={it.nombreProducto}
                      onChange={e => onProductoInput(it.key, e.target.value)}
                      onBlur={() => setTimeout(() => setShowProdSugs(p => ({ ...p, [it.key]: false })), 200)}
                      placeholder="Buscar producto..."
                      style={{ ...inpStyle, borderColor: sinId ? "#F59E0B" : undefined }}
                    />
                    {showProdSugs[it.key] && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, zIndex: 50, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                        {(prodSugs[it.key] ?? []).map(p => (
                          <button key={p.id} type="button" onMouseDown={() => selectProducto(it.key, p)}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                            {p.nombre} <span style={{ color: "var(--erp-text-3)", fontSize: 11 }}>stock: {p.stockActual}</span>
                          </button>
                        ))}
                        {(prodSugs[it.key] ?? []).length === 0 && (
                          <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--erp-text-3)" }}>No encontrado</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ width: 80 }}>
                    {idx === 0 && <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>CANT.</label>}
                    <input type="number" value={it.cantidad} min="0.01" step="0.01" onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, cantidad: e.target.value } : x))} style={{ ...inpStyle, textAlign: "right" }} />
                  </div>
                  <div style={{ width: 110 }}>
                    {idx === 0 && <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>COSTO Bs</label>}
                    <input type="number" value={it.costoUnitBs} min="0" step="0.01" onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, costoUnitBs: e.target.value } : x))} placeholder="0.00" style={{ ...inpStyle, textAlign: "right" }} />
                  </div>
                  <div style={{ width: 85, paddingTop: idx === 0 ? 20 : 0, textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--erp-text)", padding: idx === 0 ? "20px 4px 8px" : "8px 4px", fontVariantNumeric: "tabular-nums" }}>
                    {((Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0)).toFixed(2)}
                  </div>
                  <div style={{ paddingTop: idx === 0 ? 20 : 0 }}>
                    <button type="button" onClick={() => setItems(prev => prev.filter(x => x.key !== it.key))} disabled={items.length === 1}
                      style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, width: 32, height: 32, cursor: "pointer", color: "var(--erp-text-3)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                </div>

                {/* Estado del producto */}
                {it.productoId && (
                  <div style={{ marginTop: 3, fontSize: 11, color: "#166534" }}>✓ Vinculado al inventario</div>
                )}
                {sinId && !it.showCreate && (
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#92400E", background: "#FEF3C7", borderRadius: 6, padding: "2px 8px" }}>Producto no encontrado</span>
                    {puedeCrearProducto && (
                      <button type="button" onClick={() => toggleCreateProd(it.key)}
                        style={{ fontSize: 11, color: "var(--erp-primary)", background: "var(--erp-primary-lt)", border: "none", borderRadius: 6, padding: "2px 10px", cursor: "pointer", fontWeight: 600 }}>
                        + Crear producto
                      </button>
                    )}
                  </div>
                )}

                {/* Mini-form crear producto */}
                {sinId && it.showCreate && puedeCrearProducto && (
                  <div style={{ marginTop: 8, background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-primary)", marginBottom: 8 }}>Crear producto nuevo — se agregará al inventario</div>
                    <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>Categoría</label>
                        <select
                          value={it.categoriaId ?? ""}
                          onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, categoriaId: e.target.value ? Number(e.target.value) : null } : x))}
                          style={{ ...inpStyle }}>
                          <option value="">Sin categoría</option>
                          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>Uso del producto</label>
                        <select
                          value={it.paraVenta ? "venta" : "materia"}
                          onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, paraVenta: e.target.value === "venta" } : x))}
                          style={{ ...inpStyle }}>
                          <option value="venta">Para venta</option>
                          <option value="materia">Materia prima / insumo</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--erp-text-3)" }}>
                      {it.paraVenta ? "Se creará con precio de venta igual al costo" : "Se creará con precio de venta = 0 (no aparece en ventas)"}
                    </div>
                    <button type="button" onClick={() => toggleCreateProd(it.key)}
                      style={{ marginTop: 8, fontSize: 11, color: "var(--erp-text-3)", background: "none", border: "none", cursor: "pointer" }}>
                      Cancelar creación
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => setItems(prev => [...prev, { key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "", paraVenta: true }])}
            style={{ alignSelf: "flex-start", background: "none", border: "1px dashed var(--erp-border)", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "var(--erp-primary)", cursor: "pointer", fontWeight: 600 }}>
            + Agregar ítem
          </button>
        </div>
        <div style={{ marginTop: 12, borderTop: "1px solid var(--erp-border)", paddingTop: 12, display: "flex", justifyContent: "flex-end", gap: 24 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Total Bs</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--erp-text)", fontVariantNumeric: "tabular-nums" }}>Bs {totalBs.toFixed(2)}</div>
          </div>
          {tasa > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Total USD</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--erp-primary)", fontVariantNumeric: "tabular-nums" }}>${totalUsd.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderDatosFactura() {
    return (
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Datos de la Factura</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inpStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>N° Factura</label>
            <input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="Ej: 00001234" style={inpStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Tasa del día (Bs/$)</label>
            <input type="number" value={tasaDia} onChange={e => setTasaDia(e.target.value)} placeholder="0.00" style={inpStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Vencimiento pago</label>
            <input type="date" value={fechaVencimientoPago} onChange={e => setFechaVencimientoPago(e.target.value)} style={inpStyle} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Observaciones</label>
            <input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" style={inpStyle} />
          </div>
        </div>
      </div>
    );
  }

  function renderOCR() {
    return (
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Imagen de factura (opcional — OCR automático)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={() => fileRef.current?.click()} style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📁 Galería</button>
          <button type="button" onClick={() => cameraRef.current?.click()} style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📷 Cámara</button>
          {ocrLoading && <span style={{ fontSize: 13, color: "var(--erp-text-2)" }}>Analizando con IA...</span>}
          {ocrError && <span style={{ fontSize: 12, color: "#B91C1C" }}>{ocrError}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
        {imagenBase64 && !ocrLoading && (
          <div style={{ marginTop: 10 }}>
            <img src={imagenBase64} alt="Factura" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, border: "1px solid var(--erp-border)", objectFit: "contain" }} />
          </div>
        )}
      </div>
    );
  }

  const btnSecondary: React.CSSProperties = { background: "none", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", color: "var(--erp-text-2)" };
  const btnPrimary = (disabled: boolean): React.CSSProperties => ({ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 });

  // ── MODO EDICIÓN: form plano ───────────────────────────────────────────────
  if (isEdit) {
    return (
      <div className="flex flex-col gap-4" style={{ maxWidth: 700 }}>
        {/* Proveedor plano */}
        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Proveedor</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1", position: "relative" }}>
              <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Nombre *</label>
              <input value={proveedorQ} onChange={e => onProveedorInput(e.target.value)} onBlur={() => setTimeout(() => setShowProvSugs(false), 200)} placeholder="Buscar proveedor..." style={inpStyle} />
              {showProvSugs && provSugs.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, zIndex: 50, maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                  {provSugs.map(p => (
                    <button key={p.id} type="button" onMouseDown={() => applyProveedor(p)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                      <strong>{p.nombre}</strong>{p.rif && <span style={{ color: "var(--erp-text-3)", marginLeft: 6, fontSize: 11 }}>{p.rif}</span>}
                    </button>
                  ))}
                </div>
              )}
              {proveedorId && <div style={{ marginTop: 3, fontSize: 11, color: "#166534" }}>✓ Proveedor vinculado</div>}
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>RIF / C.I.</label>
              <input value={proveedorRif} onChange={e => setProveedorRif(e.target.value)} placeholder="J-12345678-9" style={inpStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Teléfono</label>
              <input value={proveedorTel} onChange={e => setProveedorTel(e.target.value)} placeholder="0412-0000000" style={inpStyle} />
            </div>
          </div>
        </div>
        {renderProductos()}
        {renderDatosFactura()}
        {renderOCR()}
        {saveError && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{saveError}</div>}
        <div className="flex gap-3 justify-between">
          <button type="button" onClick={onCancel} style={btnSecondary}>Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={saving} style={btnPrimary(saving)}>
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    );
  }

  // ── WIZARD (nueva factura) ─────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700 }}>
      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i <= step ? "var(--erp-primary)" : "var(--erp-border)", color: i <= step ? "#fff" : "var(--erp-text-3)" }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: i === step ? "var(--erp-primary)" : "var(--erp-text-3)", whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? "var(--erp-primary)" : "var(--erp-border)", margin: "0 6px", marginBottom: 16 }} />}
          </div>
        ))}
      </div>

      {/* Paso 0: Proveedor */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Buscar Proveedor</div>
            <div style={{ position: "relative" }}>
              <input value={proveedorQ} onChange={e => onProveedorInput(e.target.value)} onBlur={() => setTimeout(() => setShowProvSugs(false), 200)}
                placeholder="Escribe nombre o RIF del proveedor..." style={inpStyle} autoFocus />
              {showProvSugs && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                  {provSugs.length > 0 ? provSugs.map(p => (
                    <button key={p.id} type="button" onMouseDown={() => applyProveedor(p)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                      <strong>{p.nombre}</strong>
                      {p.rif && <span style={{ color: "var(--erp-text-3)", marginLeft: 8, fontSize: 11 }}>{p.rif}</span>}
                      {(p.diasCredito ?? 0) > 0 && <span style={{ color: "var(--erp-primary)", marginLeft: 8, fontSize: 11 }}>{p.diasCredito}d crédito</span>}
                    </button>
                  )) : <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--erp-text-3)" }}>No encontrado — completa los datos abajo para crear</div>}
                </div>
              )}
            </div>

            {provConfirmado && (
              <div style={{ marginTop: 12, background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#166534" }}>{proveedorQ}</div>
                  {proveedorRif && <div style={{ fontSize: 11, color: "#166534" }}>{proveedorRif}</div>}
                  {proveedorDiasCredito > 0 && <div style={{ fontSize: 11, color: "#166534" }}>{proveedorDiasCredito} días de crédito</div>}
                </div>
                <button type="button" onClick={() => { setProveedorId(null); setProveedorQ(""); setProvSearched(false); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: 12 }}>Cambiar</button>
              </div>
            )}

            {provNuevo && provSearched && (
              <div style={{ marginTop: 12, background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-primary)", marginBottom: 10 }}>Proveedor nuevo — se creará al registrar la factura</div>
                <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>RIF / C.I.</label>
                    <input value={proveedorRif} onChange={e => setProveedorRif(e.target.value)} placeholder="J-12345678-9" style={inpStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>Teléfono</label>
                    <input value={proveedorTel} onChange={e => setProveedorTel(e.target.value)} placeholder="0412-0000000" style={inpStyle} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>Dirección</label>
                    <input value={proveedorDir} onChange={e => setProveedorDir(e.target.value)} placeholder="Dirección" style={inpStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>Días de crédito</label>
                    <input type="number" min="0" value={proveedorDiasCredito} onChange={e => setProveedorDiasCredito(Number(e.target.value))} style={inpStyle} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-between">
            <button type="button" onClick={onCancel} style={btnSecondary}>Cancelar</button>
            <button type="button" onClick={() => setStep(1)} disabled={!proveedorQ.trim()} style={btnPrimary(!proveedorQ.trim())}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* Paso 1: Productos */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {renderProductos()}
          <div className="flex gap-3 justify-between">
            <button type="button" onClick={() => setStep(0)} style={btnSecondary}>← Atrás</button>
            <button type="button" onClick={() => setStep(2)} disabled={!items.some(it => it.nombreProducto.trim() && Number(it.cantidad) > 0)} style={btnPrimary(!items.some(it => it.nombreProducto.trim() && Number(it.cantidad) > 0))}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* Paso 2: Factura + OCR */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {renderOCR()}
          {renderDatosFactura()}
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", marginBottom: 8 }}>Resumen</div>
            <div style={{ fontSize: 13, color: "var(--erp-text)" }}>
              <strong>{proveedorQ}</strong>
              {proveedorId ? <span style={{ color: "#166534", marginLeft: 8, fontSize: 11 }}>✓ existe</span> : <span style={{ color: "#92400E", marginLeft: 8, fontSize: 11 }}>nuevo</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--erp-text-3)", marginTop: 4 }}>
              {items.filter(it => it.nombreProducto.trim()).length} producto(s) · Bs {totalBs.toFixed(2)}{tasa > 0 ? ` · $${totalUsd.toFixed(2)}` : ""}
            </div>
            {items.some(it => it.nombreProducto.trim() && !it.productoId && it.showCreate) && (
              <div style={{ fontSize: 11, color: "#92400E", marginTop: 4 }}>
                ⚠ {items.filter(it => it.nombreProducto.trim() && !it.productoId && it.showCreate).length} producto(s) nuevo(s) se crearán en inventario
              </div>
            )}
          </div>
          {saveError && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{saveError}</div>}
          <div className="flex gap-3 justify-between">
            <button type="button" onClick={() => setStep(1)} style={btnSecondary}>← Atrás</button>
            <button type="button" onClick={handleSubmit} disabled={saving} style={btnPrimary(saving)}>
              {saving ? "Guardando..." : "Registrar Factura"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";

type ItemLine = {
  key: number;
  productoId: number | null;
  nombreProducto: string;
  cantidad: string;
  costoUnitBs: string;
};

type ProductoSug = { id: number; nombre: string; stockActual: number };
type ProveedorSug = { id: number; nombre: string; rif: string | null; telefono: string | null; direccion: string | null; diasCredito: number };

type FacturaDetalle = {
  id: number;
  fecha: string;
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

export default function FacturaCompraForm({
  tasaBcv,
  puedeCrearProducto,
  onCancel,
  onCreated,
  initialData,
  onUpdated,
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

  // Proveedor
  const [proveedorQ, setProveedorQ] = useState(initialData?.proveedorNombre ?? "");
  const [proveedorId, setProveedorId] = useState<number | null>(null);
  const [proveedorRif, setProveedorRif] = useState(initialData?.proveedorRif ?? "");
  const [proveedorTel, setProveedorTel] = useState("");
  const [proveedorDir, setProveedorDir] = useState("");
  const [provSugs, setProvSugs] = useState<ProveedorSug[]>([]);
  const [showProvSugs, setShowProvSugs] = useState(false);
  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Factura
  const [fecha, setFecha] = useState(initialData?.fecha?.slice(0, 10) ?? today);
  const [numeroFactura, setNumeroFactura] = useState(initialData?.numeroFactura ?? "");
  const [observaciones, setObservaciones] = useState(initialData?.observaciones ?? "");
  const [tasaDia, setTasaDia] = useState(initialData ? String(initialData.tasaDia) : (tasaBcv > 0 ? String(tasaBcv) : ""));
  const [fechaVencimientoPago, setFechaVencimientoPago] = useState(initialData?.fechaVencimientoPago?.slice(0, 10) ?? "");

  // Items
  const [items, setItems] = useState<ItemLine[]>(
    initialData?.items?.length
      ? initialData.items.map((it) => ({ key: nextKey(), productoId: it.productoId, nombreProducto: it.nombreProducto, cantidad: String(it.cantidad), costoUnitBs: String(it.costoUnitBs) }))
      : [{ key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "" }]
  );
  const [prodSugs, setProdSugs] = useState<Record<number, ProductoSug[]>>({});
  const [showProdSugs, setShowProdSugs] = useState<Record<number, boolean>>({});
  const prodTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Imagen / OCR
  const [imagenBase64, setImagenBase64] = useState<string | null>(initialData?.imagenFactura ?? null);
  const [imagenMime, setImagenMime] = useState("image/jpeg");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Submit
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Proveedor search ──────────────────────────────────────────────────────
  function onProveedorInput(val: string) {
    setProveedorQ(val);
    setProveedorId(null);
    if (provTimer.current) clearTimeout(provTimer.current);
    if (!val.trim()) { setProvSugs([]); setShowProvSugs(false); return; }
    provTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/proveedores?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        setProvSugs((d.items ?? []).map((p: { id: number; nombre: string; rifCi: string | null; telefono: string | null; direccion: string | null }) => ({ id: p.id, nombre: p.nombre, rif: p.rifCi, telefono: p.telefono, direccion: p.direccion })));
        setShowProvSugs(true);
      } catch { /* ignore */ }
    }, 300);
  }

  function selectProveedor(p: ProveedorSug) {
    setProveedorQ(p.nombre);
    setProveedorId(p.id);
    setProveedorRif(p.rif ?? "");
    setProveedorTel(p.telefono ?? "");
    setProveedorDir(p.direccion ?? "");
    setProvSugs([]);
    setShowProvSugs(false);
    if (p.diasCredito > 0) {
      const base = fecha || today;
      const d = new Date(base);
      d.setDate(d.getDate() + p.diasCredito);
      setFechaVencimientoPago(d.toISOString().slice(0, 10));
    }
  }

  // ── Producto search ───────────────────────────────────────────────────────
  function onProductoInput(key: number, val: string) {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, nombreProducto: val, productoId: null } : it));
    if (prodTimers.current[key]) clearTimeout(prodTimers.current[key]);
    if (!val.trim()) { setProdSugs((p) => ({ ...p, [key]: [] })); setShowProdSugs((p) => ({ ...p, [key]: false })); return; }
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
    setItems((prev) => [...prev, { key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "" }]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function updateItem(key: number, field: keyof ItemLine, val: string | number | null) {
    setItems((prev) => prev.map((it) => it.key === key ? { ...it, [field]: val } : it));
  }

  // ── OCR ──────────────────────────────────────────────────────────────────
  const compressImage = (file: File): Promise<{ dataUrl: string; base64: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const MAX = 1200;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else { width = Math.round((width * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
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
      setImagenBase64(dataUrl);
      setImagenMime("image/jpeg");
      setOcrError(null);
      setOcrLoading(true);
      try {
        const res = await fetch("/api/compras/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenBase64: base64, mimeType: file.type || "image/jpeg" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const d = data.data ?? {};
        // proveedor puede ser string o { nombre, rif, direccion }
        const ocrNombre = typeof d.proveedor === "string" ? d.proveedor : (d.proveedor?.nombre ?? "");
        const ocrRif = typeof d.proveedor === "object" ? (d.proveedor?.rif ?? "") : "";
        const ocrDir = typeof d.proveedor === "object" ? (d.proveedor?.direccion ?? "") : "";

        // Buscar proveedor existente por RIF primero, luego por nombre
        let encontrado = false;
        if (ocrRif) {
          try {
            const pr = await fetch(`/api/proveedores?rif=${encodeURIComponent(ocrRif)}`);
            const pd = await pr.json();
            const match = pd.items ? pd.items[0] : (Array.isArray(pd) ? pd[0] : null);
            if (match) {
              setProveedorQ(match.nombre);
              setProveedorId(match.id);
              setProveedorRif(match.rifCi ?? ocrRif);
              setProveedorTel(match.telefono ?? "");
              setProveedorDir(match.direccion ?? ocrDir);
              encontrado = true;
            }
          } catch { /* ignorar */ }
        }
        if (!encontrado && ocrNombre) {
          try {
            const pr = await fetch(`/api/proveedores?q=${encodeURIComponent(ocrNombre)}`);
            const pd = await pr.json();
            const list = pd.items ?? (Array.isArray(pd) ? pd : []);
            const exact = list.find((p: { nombre: string }) => p.nombre.toLowerCase() === ocrNombre.toLowerCase()) ?? list[0];
            if (exact) {
              setProveedorQ(exact.nombre);
              setProveedorId(exact.id);
              setProveedorRif(exact.rifCi ?? ocrRif);
              setProveedorTel(exact.telefono ?? "");
              setProveedorDir(exact.direccion ?? ocrDir);
              encontrado = true;
            }
          } catch { /* ignorar */ }
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
            key: nextKey(),
            productoId: null,
            nombreProducto: it.nombre ?? "",
            cantidad: String(it.cantidad ?? 1),
            costoUnitBs: String(it.costo_unitario_bs ?? it.costo ?? ""),
          })));
        }
      } catch (err) {
        setOcrError(err instanceof Error ? err.message : "Error OCR");
      } finally {
        setOcrLoading(false);
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Error al procesar imagen");
    }
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!proveedorQ.trim()) { setSaveError("El proveedor es requerido"); return; }
    const validItems = items.filter((it) => it.nombreProducto.trim() && Number(it.cantidad) > 0);
    if (!validItems.length) { setSaveError("Debe agregar al menos un ítem"); return; }
    setSaving(true); setSaveError(null);
    try {
      const url = isEdit ? `/api/compras/${initialData!.id}` : "/api/compras";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          proveedorId,
          proveedorNombre: proveedorQ.trim(),
          proveedorRif: proveedorRif.trim() || null,
          numeroFactura: numeroFactura.trim() || null,
          observaciones: observaciones.trim() || null,
          tasaDia: Number(tasaDia) || 0,
          fechaVencimientoPago: fechaVencimientoPago || null,
          imagenFactura: imagenBase64,
          items: validItems.map((it) => ({
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
    } finally {
      setSaving(false);
    }
  }

  const totalBs = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0), 0);
  const tasa = Number(tasaDia) || 0;
  const totalUsd = tasa > 0 ? totalBs / tasa : 0;

  const inp = { border: "1px solid var(--erp-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", width: "100%" };

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 700 }}>
      {/* Imagen + OCR */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Imagen de factura (opcional — OCR automático)</div>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={() => fileRef.current?.click()} style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            📁 Galería
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            📷 Cámara
          </button>
          {ocrLoading && <span style={{ fontSize: 13, color: "var(--erp-text-2)" }}>Analizando con IA...</span>}
          {ocrError && <span style={{ fontSize: 12, color: "#B91C1C" }}>{ocrError}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
        {imagenBase64 && !ocrLoading && (
          <div style={{ marginTop: 10 }}>
            <img src={imagenBase64} alt="Factura" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--erp-border)", objectFit: "contain" }} />
          </div>
        )}
      </div>

      {/* Proveedor */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Proveedor</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div style={{ position: "relative", gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Nombre *</label>
            <input value={proveedorQ} onChange={(e) => onProveedorInput(e.target.value)} onBlur={() => setTimeout(() => setShowProvSugs(false), 200)} placeholder="Buscar o escribir proveedor..." style={inp} />
            {showProvSugs && provSugs.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, zIndex: 50, maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                {provSugs.map((p) => (
                  <button key={p.id} type="button" onMouseDown={() => selectProveedor(p)} style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                    <strong>{p.nombre}</strong>{p.rif ? <span style={{ color: "var(--erp-text-3)", marginLeft: 6, fontSize: 11 }}>{p.rif}</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>RIF / C.I.</label>
            <input value={proveedorRif} onChange={(e) => setProveedorRif(e.target.value)} placeholder="J-12345678-9" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Teléfono</label>
            <input value={proveedorTel} onChange={(e) => setProveedorTel(e.target.value)} placeholder="0412-0000000" style={inp} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Dirección</label>
            <input value={proveedorDir} onChange={(e) => setProveedorDir(e.target.value)} placeholder="Dirección del proveedor" style={inp} />
          </div>
        </div>
      </div>

      {/* Datos factura */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Datos de la Factura</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>N° Factura</label>
            <input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="Ej: 00001234" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Tasa del día (Bs/$)</label>
            <input type="number" value={tasaDia} onChange={(e) => setTasaDia(e.target.value)} placeholder="0.00" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Fecha vencimiento pago</label>
            <input type="date" value={fechaVencimientoPago} onChange={(e) => setFechaVencimientoPago(e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4, display: "block" }}>Observaciones</label>
            <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" style={inp} />
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Productos</div>
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <div key={it.key} className="flex gap-2 items-start">
              <div style={{ flex: 2, position: "relative" }}>
                {idx === 0 && <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>PRODUCTO</label>}
                <input
                  value={it.nombreProducto}
                  onChange={(e) => onProductoInput(it.key, e.target.value)}
                  onBlur={() => setTimeout(() => setShowProdSugs((p) => ({ ...p, [it.key]: false })), 200)}
                  placeholder="Buscar producto..."
                  style={inp}
                />
                {showProdSugs[it.key] && (prodSugs[it.key] ?? []).length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, zIndex: 50, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                    {(prodSugs[it.key] ?? []).map((p) => (
                      <button key={p.id} type="button" onMouseDown={() => selectProducto(it.key, p)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                        {p.nombre} <span style={{ color: "var(--erp-text-3)", fontSize: 11 }}>stock: {p.stockActual}</span>
                      </button>
                    ))}
                    {puedeCrearProducto && (
                      <button type="button" onMouseDown={() => { setShowProdSugs((p) => ({ ...p, [it.key]: false })); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-primary)", fontWeight: 600 }}>
                        + Crear &quot;{it.nombreProducto}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ width: 80 }}>
                {idx === 0 && <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>CANT.</label>}
                <input type="number" value={it.cantidad} min="0.01" step="0.01" onChange={(e) => updateItem(it.key, "cantidad", e.target.value)} style={{ ...inp, textAlign: "right" }} />
              </div>
              <div style={{ width: 110 }}>
                {idx === 0 && <label style={{ fontSize: 10, color: "var(--erp-text-3)", marginBottom: 3, display: "block" }}>COSTO Bs</label>}
                <input type="number" value={it.costoUnitBs} min="0" step="0.01" onChange={(e) => updateItem(it.key, "costoUnitBs", e.target.value)} placeholder="0.00" style={{ ...inp, textAlign: "right" }} />
              </div>
              <div style={{ width: 100, paddingTop: idx === 0 ? 22 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-text)", textAlign: "right", padding: "8px 4px", fontVariantNumeric: "tabular-nums" }}>
                  {((Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0)).toFixed(2)}
                </div>
              </div>
              <div style={{ paddingTop: idx === 0 ? 20 : 0 }}>
                <button type="button" onClick={() => removeItem(it.key)} disabled={items.length === 1} style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, width: 32, height: 32, cursor: "pointer", color: "var(--erp-text-3)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addItem} style={{ alignSelf: "flex-start", background: "none", border: "1px dashed var(--erp-border)", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: "var(--erp-primary)", cursor: "pointer", fontWeight: 600 }}>
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

      {saveError && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{saveError}</div>}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", color: "var(--erp-text-2)" }}>
          Cancelar
        </button>
        <button type="button" onClick={handleSubmit} disabled={saving} style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 24px", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Registrar Factura"}
        </button>
      </div>
    </div>
  );
}

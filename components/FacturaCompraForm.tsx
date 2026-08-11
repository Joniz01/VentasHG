"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type RifTipo = "J" | "V" | "E" | "G";

type ItemLine = {
  key: number;
  productoId: number | null;
  nombreProducto: string;
  cantidad: string;
  costoUnitBs: string;
  costoUnitUsd: string;
  showCreate?: boolean;
  categoriaId?: number | null;
  paraVenta?: boolean;
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

function parseRif(fullRif: string | null | undefined): { tipo: RifTipo; numero: string } {
  if (!fullRif) return { tipo: "J", numero: "" };
  const m = fullRif.match(/^([JVEGjveg])-(.+)$/);
  if (m) return { tipo: m[1].toUpperCase() as RifTipo, numero: m[2] };
  return { tipo: "J", numero: fullRif };
}

const S: React.CSSProperties = {
  border: "1px solid var(--erp-border)", borderRadius: 8, padding: "8px 12px",
  fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", width: "100%",
};

const lbl: React.CSSProperties = {
  fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4,
  display: "block", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14,
};

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

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  useEffect(() => {
    fetch("/api/categorias").then(r => r.json()).then(d => setCategorias(d ?? [])).catch(() => {});
  }, []);

  // RIF
  const [rifTipo, setRifTipo] = useState<RifTipo>(() => parseRif(initialData?.proveedorRif).tipo);
  const [rifNumero, setRifNumero] = useState(() => parseRif(initialData?.proveedorRif).numero);
  const fullRif = rifNumero.trim() ? `${rifTipo}-${rifNumero.trim()}` : "";

  // Proveedor
  const [proveedorQ, setProveedorQ] = useState(initialData?.proveedorNombre ?? "");
  const [proveedorId, setProveedorId] = useState<number | null>(initialData?.proveedorId ?? null);
  const [proveedorTel, setProveedorTel] = useState("");
  const [proveedorDir, setProveedorDir] = useState("");
  const [proveedorDiasCredito, setProveedorDiasCredito] = useState(0);
  const [provSugs, setProvSugs] = useState<ProveedorSug[]>([]);
  const [showProvSugs, setShowProvSugs] = useState(false);
  const [provNuevoPanel, setProvNuevoPanel] = useState(false);
  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Items
  const [items, setItems] = useState<ItemLine[]>(
    initialData?.items?.length
      ? initialData.items.map(it => ({ key: nextKey(), productoId: it.productoId, nombreProducto: it.nombreProducto, cantidad: String(it.cantidad), costoUnitBs: String(it.costoUnitBs), costoUnitUsd: "", paraVenta: true }))
      : [{ key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "", costoUnitUsd: "", paraVenta: true }]
  );
  const [prodSugs, setProdSugs] = useState<Record<number, ProductoSug[]>>({});
  const [showProdSugs, setShowProdSugs] = useState<Record<number, boolean>>({});
  const prodTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Factura
  const [fecha, setFecha] = useState(initialData?.fecha?.slice(0, 10) ?? today);
  const [numeroFactura, setNumeroFactura] = useState(initialData?.numeroFactura ?? "");
  const [observaciones, setObservaciones] = useState(initialData?.observaciones ?? "");
  const [tasaDia, setTasaDia] = useState(initialData ? String(initialData.tasaDia) : (tasaBcv > 0 ? String(tasaBcv) : ""));
  const [fechaVencimientoPago, setFechaVencimientoPago] = useState(initialData?.fechaVencimientoPago?.slice(0, 10) ?? "");
  const [tipoUsoFactura, setTipoUsoFactura] = useState<"VENTA" | "MATERIA_PRIMA">("VENTA");
  const [imagenBase64, setImagenBase64] = useState<string | null>(initialData?.imagenFactura ?? null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrProvider, setOcrProvider] = useState<string | null>(null);
  const [ocrVerif, setOcrVerif] = useState<{ reintentado: boolean; reintentoFallo: string | null; totalFactura: number; sumaItems: number; coincide: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [consultandoTasa, setConsultandoTasa] = useState(false);
  const [tasaBcvFecha, setTasaBcvFecha] = useState<string | null>(null);
  const [tasaBcvError, setTasaBcvError] = useState<string | null>(null);

  // Botón manual: siempre trae la tasa BCV vigente (bcv.org.ve y respaldos)
  async function handleConsultarTasaBcv() {
    setTasaBcvError(null);
    setConsultandoTasa(true);
    try {
      const res = await fetch("/api/tasa-bcv");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detalle ? `${data.error}: ${data.detalle}` : (data.error ?? "No se pudo consultar la tasa BCV"));
      setTasaDia(String(data.tasa));
      setTasaBcvFecha(data.fecha);
    } catch (err) {
      setTasaBcvError(err instanceof Error ? err.message : "No se pudo consultar la tasa BCV");
    } finally {
      setConsultandoTasa(false);
    }
  }

  // Busca en el caché local la tasa guardada para la fecha de la factura (silencioso:
  // si no hay dato cacheado para esa fecha, no muestra error — el usuario puede usar
  // el botón BCV para la tasa vigente o escribirla manualmente)
  const fechaFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEdit) return;
    if (fechaFetchedRef.current === fecha) return;
    fechaFetchedRef.current = fecha;
    (async () => {
      try {
        const res = await fetch(`/api/tasa-bcv?fecha=${fecha}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.tasa) { setTasaDia(String(data.tasa)); setTasaBcvFecha(data.fecha); }
      } catch { /* ignore */ }
    })();
  }, [fecha, isEdit]);

  const tasa = Number(tasaDia) || 0;
  const totalBs = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0), 0);
  const totalUsd = tasa > 0 ? totalBs / tasa : 0;

  // Ref con la tasa más reciente, para usar en callbacks con closures obsoletas (ej. OCR)
  const tasaRef = useRef(tasa);
  tasaRef.current = tasa;

  // Recalcula el costo USD de cada ítem cuando cambia la tasa (ej. tasa cargada/editada después de escanear)
  useEffect(() => {
    if (tasa <= 0) return;
    setItems(prev => {
      let changed = false;
      const next = prev.map(it => {
        const bs = Number(it.costoUnitBs) || 0;
        if (bs <= 0) return it;
        const usd = (bs / tasa).toFixed(4);
        if (it.costoUnitUsd === usd) return it;
        changed = true;
        return { ...it, costoUnitUsd: usd };
      });
      return changed ? next : prev;
    });
  }, [tasa]);

  function applyProveedor(p: ProveedorSug) {
    setProveedorQ(p.nombre);
    setProveedorId(p.id);
    const parsed = parseRif(p.rif);
    setRifTipo(parsed.tipo);
    setRifNumero(parsed.numero);
    setProveedorTel(p.telefono ?? "");
    setProveedorDir(p.direccion ?? "");
    setProveedorDiasCredito(p.diasCredito ?? 0);
    setShowProvSugs(false);
    setProvNuevoPanel(false);
    if ((p.diasCredito ?? 0) > 0) {
      const d = new Date(fecha || today);
      d.setDate(d.getDate() + p.diasCredito);
      setFechaVencimientoPago(d.toISOString().slice(0, 10));
    }
  }

  function onProveedorInput(val: string) {
    setProveedorQ(val);
    setProveedorId(null);
    if (provTimer.current) clearTimeout(provTimer.current);
    if (val.length < 3) { setProvSugs([]); setShowProvSugs(false); return; }
    provTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/proveedores?q=${encodeURIComponent(val)}`);
        const d = await r.json();
        const list = (d.items ?? []).map((p: { id: number; nombre: string; rifCi: string | null; telefono: string | null; direccion: string | null; diasCredito: number }) => ({
          id: p.id, nombre: p.nombre, rif: p.rifCi, telefono: p.telefono, direccion: p.direccion, diasCredito: p.diasCredito ?? 0,
        }));
        setProvSugs(list);
        setShowProvSugs(true);
      } catch { /* ignore */ }
    }, 300);
  }

  function onProductoInput(key: number, val: string) {
    setItems(prev => prev.map(it => it.key === key ? { ...it, nombreProducto: val, productoId: null, showCreate: false } : it));
    if (prodTimers.current[key]) clearTimeout(prodTimers.current[key]);
    if (val.length < 4) { setProdSugs(p => ({ ...p, [key]: [] })); setShowProdSugs(p => ({ ...p, [key]: false })); return; }
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

  function updateItemBs(key: number, bsVal: string) {
    const bs = Number(bsVal) || 0;
    const usd = tasa > 0 ? String((bs / tasa).toFixed(4)) : "";
    setItems(prev => prev.map(it => it.key === key ? { ...it, costoUnitBs: bsVal, costoUnitUsd: usd } : it));
  }

  function updateItemUsd(key: number, usdVal: string) {
    const usd = Number(usdVal) || 0;
    const bs = tasa > 0 ? String((usd * tasa).toFixed(2)) : "";
    setItems(prev => prev.map(it => it.key === key ? { ...it, costoUnitUsd: usdVal, costoUnitBs: bs } : it));
  }

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
      setImagenBase64(dataUrl); setOcrError(null); setOcrProvider(null); setOcrVerif(null); setOcrLoading(true);
      try {
        const res = await fetch("/api/compras/ocr", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenBase64: base64, mimeType: "image/jpeg" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const d = data.data ?? {};
        setOcrProvider(data.provider ?? null);
        setOcrVerif({
          reintentado: !!data._reintentado,
          reintentoFallo: data._reintentoFallo ?? null,
          totalFactura: Number(data._totalFactura) || 0,
          sumaItems: Number(data._sumaItems) || 0,
          coincide: data._coincide !== false,
        });

        // Filtra strings vacías, "null" o "undefined" que Gemini puede retornar literalmente
        const clean = (v: unknown): string => {
          if (!v || v === "null" || v === "undefined") return "";
          return String(v).trim();
        };

        // Soporta tanto el formato nuevo (campos raíz) como el legacy (objeto proveedor anidado)
        const ocrNombre: string = clean(d.proveedorNombre) || clean(typeof d.proveedor === "string" ? d.proveedor : (d.proveedor as Record<string,unknown>)?.nombre);
        const ocrRif: string = clean(d.proveedorRif) || clean(typeof d.proveedor === "object" ? (d.proveedor as Record<string,unknown>)?.rif : "");
        const ocrDir: string = clean(d.proveedorDireccion) || clean(typeof d.proveedor === "object" ? (d.proveedor as Record<string,unknown>)?.direccion : "");
        const ocrTel: string = clean(d.proveedorTelefono);
        let encontrado = false;

        if (ocrRif) {
          try {
            const pr = await fetch(`/api/proveedores?rif=${encodeURIComponent(ocrRif)}`);
            const pd = await pr.json();
            const match = (pd.items ?? [])[0];
            if (match) {
              setProveedorQ(match.nombre); setProveedorId(match.id);
              const parsed = parseRif(match.rifCi);
              setRifTipo(parsed.tipo); setRifNumero(parsed.numero);
              setProveedorTel(match.telefono ?? ""); setProveedorDir(match.direccion ?? "");
              setProveedorDiasCredito(match.diasCredito ?? 0);
              setShowProvSugs(false); setProvNuevoPanel(false);
              encontrado = true;
            }
          } catch { /* ignore */ }
        }
        if (!encontrado && ocrNombre) {
          try {
            const pr = await fetch(`/api/proveedores?q=${encodeURIComponent(ocrNombre)}`);
            const pd = await pr.json();
            const list = pd.items ?? [];
            const exact = list.find((p: { nombre: string }) => p.nombre.toLowerCase() === ocrNombre.toLowerCase()) ?? list[0];
            if (exact) {
              setProveedorQ(exact.nombre); setProveedorId(exact.id);
              const parsed = parseRif(exact.rifCi);
              setRifTipo(parsed.tipo); setRifNumero(parsed.numero);
              setProveedorTel(exact.telefono ?? ""); setProveedorDir(exact.direccion ?? "");
              setProveedorDiasCredito(exact.diasCredito ?? 0);
              setShowProvSugs(false); setProvNuevoPanel(false);
              encontrado = true;
            }
          } catch { /* ignore */ }
        }
        if (!encontrado) {
          if (ocrNombre) setProveedorQ(ocrNombre);
          if (ocrRif) { const p = parseRif(ocrRif); setRifTipo(p.tipo); setRifNumero(p.numero); }
          if (ocrDir) setProveedorDir(ocrDir);
          if (ocrTel) setProveedorTel(ocrTel);
          setProvNuevoPanel(true);
        } else if (ocrTel) {
          // Completar teléfono extraído aunque el proveedor ya exista
          setProveedorTel(ocrTel);
        }
        const numFact = clean(d.numeroFactura ?? d.numero_factura);
        if (numFact) setNumeroFactura(numFact);
        const fechaOcr = clean(d.fecha);
        if (fechaOcr && fechaOcr !== "null") setFecha(fechaOcr.slice(0, 10));
        if (Array.isArray(d.items) && d.items.length > 0) {
          const mappedItems = d.items
            .map((it: { nombre?: string; cantidad?: number; costoUnitBs?: number; costo_unitario_bs?: number; costo?: number }) => {
              const nombre = clean(it.nombre);
              if (!nombre) return null;
              const costo = it.costoUnitBs ?? it.costo_unitario_bs ?? it.costo ?? 0;
              const tRef = tasaRef.current;
              return {
                key: nextKey(), productoId: null,
                nombreProducto: nombre,
                cantidad: String(Number(it.cantidad) || 1),
                costoUnitBs: costo > 0 ? String(costo) : "",
                costoUnitUsd: (costo > 0 && tRef > 0) ? (costo / tRef).toFixed(4) : "",
                paraVenta: true,
              };
            })
            .filter(Boolean) as ItemLine[];
          if (mappedItems.length > 0) setItems(mappedItems);
        }
      } catch (err) { setOcrError(err instanceof Error ? err.message : "Error OCR"); }
      finally { setOcrLoading(false); }
    } catch (err) { setOcrError(err instanceof Error ? err.message : "Error al procesar imagen"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const validItems = items.filter(it => it.nombreProducto.trim() && Number(it.cantidad) > 0);
    if (!validItems.length) { setSaveError("Debe agregar al menos un ítem"); return; }
    if (!proveedorQ.trim()) { setSaveError("El proveedor es requerido"); return; }
    setSaving(true); setSaveError(null);
    try {
      let finalProveedorId = proveedorId;
      if (!finalProveedorId && proveedorQ.trim()) {
        const rp = await fetch("/api/proveedores", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: proveedorQ.trim(), rifCi: fullRif || null, direccion: proveedorDir.trim() || null, telefono: proveedorTel.trim() || null, diasCredito: proveedorDiasCredito || 0 }),
        });
        const rd = await rp.json();
        if (!rp.ok) throw new Error(`Error al crear proveedor: ${rd.error}`);
        finalProveedorId = rd.id;
      }

      const resolvedItems = await Promise.all(validItems.map(async it => {
        if (it.productoId) return it;
        if (!puedeCrearProducto || !it.showCreate) return it;
        try {
          const rp = await fetch("/api/productos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: it.nombreProducto.trim(), costo: Number(it.costoUnitBs) || 0, precioVenta: it.paraVenta ? Number(it.costoUnitBs) || 0 : 0, categoriaId: it.categoriaId || null, tipoProducto: "NORMAL", stockActual: 0, stockMinimo: 0 }),
          });
          const rd = await rp.json();
          if (rp.ok && rd.id) return { ...it, productoId: rd.id };
        } catch { /* ignore */ }
        return it;
      }));

      const url = isEdit ? `/api/compras/${initialData!.id}` : "/api/compras";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha, proveedorId: finalProveedorId,
          proveedorNombre: proveedorQ.trim(),
          proveedorRif: fullRif || null,
          numeroFactura: numeroFactura.trim() || null,
          observaciones: observaciones.trim() || null,
          tasaDia: Number(tasaDia) || 0,
          fechaVencimientoPago: fechaVencimientoPago || null,
          imagenFactura: imagenBase64,
          tipoUso: tipoUsoFactura,
          items: resolvedItems.map(it => ({ productoId: it.productoId, nombreProducto: it.nombreProducto.trim(), cantidad: Number(it.cantidad), costoUnitBs: Number(it.costoUnitBs) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (isEdit) { onUpdated?.(); } else { onCreated(); }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar");
    } finally { setSaving(false); }
  }

  function RifField() {
    return (
      <div>
        <label style={lbl}>RIF / C.I.</label>
        <div style={{ display: "flex", gap: 0, marginBottom: 6, border: "1px solid var(--erp-border)", borderRadius: 8, overflow: "hidden", width: "fit-content" }}>
          {(["J", "V", "E", "G"] as RifTipo[]).map((t, i, arr) => (
            <button key={t} type="button" onClick={() => setRifTipo(t)}
              style={{ background: rifTipo === t ? "var(--erp-primary)" : "var(--erp-bg)", color: rifTipo === t ? "#fff" : "var(--erp-text-2)", border: "none", padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRight: i < arr.length - 1 ? "1px solid var(--erp-border)" : "none" }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ background: "var(--erp-bg)", border: "1px solid var(--erp-border)", borderRight: "none", borderRadius: "8px 0 0 8px", padding: "8px 10px", fontWeight: 700, fontSize: 13, color: "var(--erp-primary)", userSelect: "none", flexShrink: 0, display: "flex", alignItems: "center" }}>
            {rifTipo}-
          </div>
          <input value={rifNumero} onChange={e => setRifNumero(e.target.value.replace(/[^0-9\-]/g, ""))} placeholder="12345678-9"
            style={{ ...S, borderRadius: "0 8px 8px 0", borderLeft: "none" }} />
        </div>
        <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 3 }}>Formato: {rifTipo}-12345678-9</div>
      </div>
    );
  }

  function renderProductRows() {
    return items.map((it) => {
      const sinId = it.nombreProducto.trim() && !it.productoId;
      return (
        <tr key={it.key} style={{ borderBottom: "1px solid var(--erp-border)" }}>
          <td style={{ padding: "5px 6px", minWidth: 180 }}>
            <div style={{ position: "relative" }}>
              <input value={it.nombreProducto} onChange={e => onProductoInput(it.key, e.target.value)}
                onBlur={() => setTimeout(() => setShowProdSugs(p => ({ ...p, [it.key]: false })), 200)}
                placeholder="Buscar (4ª letra)…"
                style={{ ...S, borderColor: sinId ? "#F59E0B" : undefined }} />
              {showProdSugs[it.key] && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.12)", maxHeight: 160, overflowY: "auto" }}>
                  {(prodSugs[it.key] ?? []).map(p => (
                    <button key={p.id} type="button" onMouseDown={() => selectProducto(it.key, p)}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                      {p.nombre} <span style={{ color: "var(--erp-text-3)", fontSize: 11 }}>stock: {p.stockActual}</span>
                    </button>
                  ))}
                  {(prodSugs[it.key] ?? []).length === 0 && (
                    <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--erp-text-3)" }}>No encontrado</div>
                  )}
                  {puedeCrearProducto && it.nombreProducto.trim() && (
                    <button type="button" onMouseDown={() => { setItems(prev => prev.map(x => x.key === it.key ? { ...x, showCreate: true } : x)); setShowProdSugs(p => ({ ...p, [it.key]: false })); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "var(--erp-primary-lt)", border: "none", cursor: "pointer", fontSize: 12, color: "var(--erp-primary)", fontWeight: 600, borderTop: "1px solid var(--erp-border)" }}>
                      ＋ Crear "{it.nombreProducto}" en inventario
                    </button>
                  )}
                </div>
              )}
            </div>
            {it.productoId && <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>✓ En inventario</div>}
            {sinId && !it.showCreate && (
              <div style={{ marginTop: 3, display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#92400E", background: "#FEF3C7", borderRadius: 6, padding: "1px 6px" }}>Producto nuevo</span>
                {puedeCrearProducto && (
                  <button type="button" onClick={() => setItems(prev => prev.map(x => x.key === it.key ? { ...x, showCreate: true } : x))}
                    style={{ fontSize: 11, color: "var(--erp-primary)", background: "var(--erp-primary-lt)", border: "none", borderRadius: 6, padding: "1px 8px", cursor: "pointer", fontWeight: 600 }}>
                    + Agregar al inventario
                  </button>
                )}
              </div>
            )}
            {sinId && it.showCreate && puedeCrearProducto && (
              <div style={{ marginTop: 6, background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-primary)", marginBottom: 6 }}>Se creará en inventario al registrar</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--erp-text-3)", display: "block", marginBottom: 2 }}>Categoría</label>
                    <select value={it.categoriaId ?? ""} onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, categoriaId: e.target.value ? Number(e.target.value) : null } : x))} style={{ ...S, fontSize: 12 }}>
                      <option value="">Sin categoría</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--erp-text-3)", display: "block", marginBottom: 2 }}>Uso</label>
                    <select value={it.paraVenta ? "venta" : "materia"} onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, paraVenta: e.target.value === "venta" } : x))} style={{ ...S, fontSize: 12 }}>
                      <option value="venta">Para venta</option>
                      <option value="materia">Materia prima</option>
                    </select>
                  </div>
                </div>
                <button type="button" onClick={() => setItems(prev => prev.map(x => x.key === it.key ? { ...x, showCreate: false } : x))}
                  style={{ marginTop: 6, fontSize: 11, color: "var(--erp-text-3)", background: "none", border: "none", cursor: "pointer" }}>Cancelar</button>
              </div>
            )}
          </td>
          <td style={{ padding: "5px 6px", width: 80 }}>
            <input type="number" value={it.cantidad} min="0.01" step="0.01"
              onChange={e => setItems(prev => prev.map(x => x.key === it.key ? { ...x, cantidad: e.target.value } : x))}
              style={{ ...S, textAlign: "right" }} />
          </td>
          <td style={{ padding: "5px 6px", width: 120 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", pointerEvents: "none" }}>Bs</span>
              <input type="number" value={it.costoUnitBs} min="0" step="0.01" onChange={e => updateItemBs(it.key, e.target.value)}
                placeholder="0.00" style={{ ...S, paddingLeft: 28, textAlign: "right" }} />
            </div>
          </td>
          <td style={{ padding: "5px 6px", width: 110 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", pointerEvents: "none" }}>$</span>
              <input type="number" value={it.costoUnitUsd} min="0" step="0.0001" onChange={e => updateItemUsd(it.key, e.target.value)}
                placeholder="0.00" style={{ ...S, paddingLeft: 22, textAlign: "right", color: "var(--erp-text-2)" }} />
            </div>
          </td>
          <td style={{ padding: "5px 12px", textAlign: "right", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--erp-text)", whiteSpace: "nowrap" }}>
            {((Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0)).toFixed(2)}
          </td>
          <td style={{ padding: "5px 6px", textAlign: "center" }}>
            <button type="button" onClick={() => setItems(prev => prev.filter(x => x.key !== it.key))} disabled={items.length === 1}
              style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, width: 30, height: 30, cursor: "pointer", color: "var(--erp-text-3)", fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </td>
        </tr>
      );
    });
  }

  const btnPrimary = (disabled: boolean): React.CSSProperties => ({
    background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8,
    padding: "9px 24px", fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
  });
  const btnSecondary: React.CSSProperties = { background: "none", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", color: "var(--erp-text-2)" };

  // ── EDIT MODE ──────────────────────────────────────────────────────────────
  if (isEdit) {
    return (
      <div className="flex flex-col gap-4" style={{ maxWidth: 760 }}>
        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
          <div style={sectionTitle}>Proveedor</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
            <RifField />
            <div style={{ position: "relative" }}>
              <label style={lbl}>Nombre *</label>
              <input value={proveedorQ} onChange={e => onProveedorInput(e.target.value)} onBlur={() => setTimeout(() => setShowProvSugs(false), 200)} placeholder="Buscar proveedor..." style={S} />
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
          </div>
        </div>

        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
          <div style={sectionTitle}>Productos</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--erp-bg)" }}>
                  {[["Producto", "left"], ["Cantidad", "left"], ["Costo Bs", "left"], ["Costo USD", "left"], ["Subtotal Bs", "right"], ["", "center"]].map(([h, a]) => (
                    <th key={h} style={{ padding: "8px 6px", textAlign: a as "left" | "right" | "center", color: "var(--erp-text-3)", fontWeight: 600, fontSize: 11, borderBottom: "1px solid var(--erp-border)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderProductRows()}</tbody>
            </table>
          </div>
          <button type="button" onClick={() => setItems(prev => [...prev, { key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "", costoUnitUsd: "", paraVenta: true }])}
            style={{ marginTop: 10, background: "none", border: "1px dashed var(--erp-border)", borderRadius: 8, padding: "6px 0", fontSize: 13, color: "var(--erp-primary)", cursor: "pointer", fontWeight: 600, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            + Agregar ítem
          </button>
          <div style={{ marginTop: 12, borderTop: "1px solid var(--erp-border)", paddingTop: 12, display: "flex", justifyContent: "flex-end", gap: 24 }}>
            {tasa > 0 && <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Total USD</div><div style={{ fontSize: 16, fontWeight: 800, color: "var(--erp-primary)", fontVariantNumeric: "tabular-nums" }}>${totalUsd.toFixed(2)}</div></div>}
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase" }}>Total Bs</div><div style={{ fontSize: 18, fontWeight: 800, color: "var(--erp-text)", fontVariantNumeric: "tabular-nums" }}>Bs {totalBs.toFixed(2)}</div></div>
          </div>
        </div>

        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
          <div style={sectionTitle}>Datos de la Factura</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={S} /></div>
            <div><label style={lbl}>N° Factura</label><input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="Ej: 00001234" style={S} /></div>
            <div>
              <label style={lbl}>Tasa del día (Bs/$)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" value={tasaDia} onChange={e => setTasaDia(e.target.value)} style={S} />
                <button type="button" onClick={() => handleConsultarTasaBcv()} disabled={consultandoTasa}
                  style={{ flexShrink: 0, background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: consultandoTasa ? "not-allowed" : "pointer" }}>
                  {consultandoTasa ? "..." : "BCV"}
                </button>
              </div>
              {tasaBcvFecha && <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 3 }}>BCV: {tasaBcvFecha}</div>}
              {tasaBcvError && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 3 }}>{tasaBcvError}</div>}
            </div>
            <div><label style={lbl}>Vencimiento pago</label><input type="date" value={fechaVencimientoPago} onChange={e => setFechaVencimientoPago(e.target.value)} style={S} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Observaciones</label><input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" style={S} /></div>
          </div>
        </div>

        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
          <div style={sectionTitle}>Imagen de factura</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Galería</button>
            <button type="button" onClick={() => cameraRef.current?.click()} style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cámara</button>
            {ocrLoading && <span style={{ fontSize: 13, color: "var(--erp-text-2)" }}>Analizando...</span>}
            {ocrError && <span style={{ fontSize: 12, color: "#B91C1C" }}>{ocrError}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
          {imagenBase64 && !ocrLoading && <img src={imagenBase64} alt="Factura" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8, border: "1px solid var(--erp-border)", objectFit: "contain", marginTop: 10 }} />}
        </div>

        {saveError && <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{saveError}</div>}
        <div className="flex gap-3 justify-between">
          <button type="button" onClick={onCancel} style={btnSecondary}>Cancelar</button>
          <button type="button" onClick={handleSubmit} disabled={saving} style={btnPrimary(saving)}>{saving ? "Guardando..." : "Guardar Cambios"}</button>
        </div>
      </div>
    );
  }

  // ── NEW FORM ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 760 }}>
      {/* OCR Strip */}
      <div style={{ background: "var(--erp-primary-lt)", borderRadius: "12px 12px 0 0", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, border: "1px solid var(--erp-border)", borderBottom: "none" }}>
        <div style={{ width: 40, height: 40, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📷</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--erp-text)", fontSize: 13, fontWeight: 600 }}>Escanear / Cargar factura</div>
          <div style={{ color: "var(--erp-text-3)", fontSize: 11, marginTop: 2 }}>Auto-extrae datos de la factura</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => cameraRef.current?.click()} style={{ background: "var(--erp-primary)", color: "#fff", border: "none", padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>📸 Cámara</button>
          <button type="button" onClick={() => fileRef.current?.click()} style={{ background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>⬆ Subir</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); }} />
      </div>

      {(ocrLoading || ocrError || (imagenBase64 && !ocrLoading)) && (
        <div style={{ background: "var(--erp-primary-lt)", borderTop: "1px solid var(--erp-border)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {ocrLoading && <><span style={{ color: "var(--erp-primary)" }}>🔍</span><span style={{ color: "var(--erp-text-2)", fontSize: 13 }}>Analizando factura con IA...</span></>}
          {!ocrLoading && imagenBase64 && !ocrError && (
            <>
              <span style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "1px solid var(--erp-border)", borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>✓ Procesada</span>
              {ocrProvider && (
                <span style={{ color: "var(--erp-text-3)", fontSize: 11, fontWeight: 600 }}>
                  vía {ocrProvider === "gemini" ? "Gemini" : "Groq"}
                </span>
              )}
              <span style={{ color: "var(--erp-text-2)", fontSize: 12 }}>Datos pre-cargados — revisa y completa los faltantes</span>
              <img src={imagenBase64} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4, marginLeft: "auto" }} />
            </>
          )}
          {ocrError && <span style={{ color: "#FCA5A5", fontSize: 12 }}>⚠ {ocrError}</span>}
        </div>
      )}

      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderTop: "none", borderRadius: "0 0 12px 12px" }}>

        {/* ① Proveedor */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--erp-border)" }}>
          <div style={sectionTitle}>① Proveedor</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
            <RifField />
            <div>
              <label style={lbl}>Nombre del proveedor</label>
              <div style={{ position: "relative" }}>
                <input value={proveedorQ} onChange={e => onProveedorInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowProvSugs(false), 200)}
                  placeholder="Buscar desde la 3ª letra…" style={S} />
                {showProvSugs && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, zIndex: 50, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.12)" }}>
                    {provSugs.length > 0 ? provSugs.map(p => (
                      <button key={p.id} type="button" onMouseDown={() => applyProveedor(p)}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-text)", borderBottom: "1px solid var(--erp-border)" }}>
                        <strong>{p.nombre}</strong>
                        {p.rif && <span style={{ color: "var(--erp-text-3)", marginLeft: 8, fontSize: 11 }}>{p.rif}</span>}
                        {(p.diasCredito ?? 0) > 0 && <span style={{ color: "var(--erp-primary)", marginLeft: 8, fontSize: 11 }}>{p.diasCredito}d crédito</span>}
                      </button>
                    )) : <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--erp-text-3)" }}>No encontrado</div>}
                    <button type="button" onMouseDown={() => { setShowProvSugs(false); setProvNuevoPanel(true); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "var(--erp-primary-lt)", border: "none", cursor: "pointer", fontSize: 12, color: "var(--erp-primary)", fontWeight: 600, borderTop: "1px solid var(--erp-border)" }}>
                      ＋ Registrar &quot;{proveedorQ}&quot; como nuevo proveedor
                    </button>
                  </div>
                )}
              </div>
              {proveedorId && (
                <div style={{ marginTop: 8, background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#166534" }}>✓</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#166534" }}>{proveedorQ}</span>
                  {proveedorDiasCredito > 0 && <span style={{ fontSize: 11, color: "#166534" }}>{proveedorDiasCredito}d crédito</span>}
                  <button type="button" onClick={() => { setProveedorId(null); setProveedorQ(""); setProvNuevoPanel(false); }} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: 12 }}>Cambiar</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 4 }}>Busca por nombre o RIF. Si no existe, registralo como nuevo.</div>
            </div>
          </div>

          {provNuevoPanel && !proveedorId && proveedorQ.trim() && (
            <div style={{ marginTop: 14, background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-primary)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Nuevo proveedor — se creará al registrar la compra</span>
                <button type="button" onClick={() => setProvNuevoPanel(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)", fontSize: 14 }}>✕</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ ...lbl, fontSize: 10 }}>Teléfono</label><input value={proveedorTel} onChange={e => setProveedorTel(e.target.value)} placeholder="0412-0000000" style={S} /></div>
                <div><label style={{ ...lbl, fontSize: 10 }}>Días de crédito</label><input type="number" min="0" value={proveedorDiasCredito} onChange={e => setProveedorDiasCredito(Number(e.target.value))} style={S} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={{ ...lbl, fontSize: 10 }}>Dirección</label><input value={proveedorDir} onChange={e => setProveedorDir(e.target.value)} placeholder="Dirección del proveedor" style={S} /></div>
              </div>
            </div>
          )}
        </div>

        {/* ② Productos */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--erp-border)" }}>
          <div style={{ ...sectionTitle, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span>② Productos</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 500 }}>Tipo:</span>
              <div style={{ display: "flex", borderRadius: 6, border: "1px solid var(--erp-border)", overflow: "hidden", fontSize: 12 }}>
                {([["VENTA", "Para venta"], ["MATERIA_PRIMA", "Materia prima"]] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setTipoUsoFactura(val)}
                    style={{ padding: "4px 10px", border: "none", cursor: "pointer", fontWeight: tipoUsoFactura === val ? 600 : 400,
                      background: tipoUsoFactura === val ? "var(--erp-primary)" : "var(--erp-surface)",
                      color: tipoUsoFactura === val ? "#fff" : "var(--erp-text-2)" }}>
                    {label}
                  </button>
                ))}
              </div>
              <span style={{ fontWeight: 400, fontSize: 11, color: "var(--erp-text-3)" }}>{items.length} línea{items.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--erp-bg)" }}>
                  {[["Producto", "left"], ["Cantidad", "left"], ["Costo (Bs)", "left"], ["Costo (USD)", "left"], ["Subtotal Bs", "right"], ["", "center"]].map(([h, a]) => (
                    <th key={h} style={{ padding: "8px 6px", textAlign: a as "left" | "right" | "center", color: "var(--erp-text-3)", fontWeight: 600, fontSize: 11, borderBottom: "1px solid var(--erp-border)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderProductRows()}</tbody>
            </table>
          </div>
          <button type="button" onClick={() => setItems(prev => [...prev, { key: nextKey(), productoId: null, nombreProducto: "", cantidad: "1", costoUnitBs: "", costoUnitUsd: "", paraVenta: true }])}
            style={{ marginTop: 10, background: "none", border: "1px dashed var(--erp-border)", borderRadius: 8, padding: "7px 0", fontSize: 13, color: "var(--erp-primary)", cursor: "pointer", fontWeight: 600, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            ＋ Agregar producto
          </button>
        </div>

        {/* Totals */}
        <div style={{ padding: "12px 20px", background: "var(--erp-bg)", borderBottom: "1px solid var(--erp-border)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 20, flexWrap: "wrap" }}>
          {tasa > 0 && <div style={{ fontSize: 12, color: "var(--erp-text-3)" }}>Tasa BCV: <strong style={{ color: "var(--erp-text-2)" }}>Bs {tasa.toFixed(2)} / $</strong></div>}
          {tasa > 0 && <div style={{ width: 1, height: 30, background: "var(--erp-border)" }} />}
          {tasa > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total USD</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-primary)", fontVariantNumeric: "tabular-nums" }}>${totalUsd.toFixed(2)}</div>
            </div>
          )}
          <div style={{ width: 1, height: 30, background: "var(--erp-border)" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--erp-text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Bs</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--erp-text)", fontVariantNumeric: "tabular-nums" }}>Bs {totalBs.toFixed(2)}</div>
          </div>
          {imagenBase64 && (
            <div style={{ width: "100%", textAlign: "right", fontSize: 11, color: "#B45309" }}>
              ⚠ Verifica los costos de cada producto contra la factura física antes de guardar
            </div>
          )}
        </div>

        {/* ③ Datos de factura */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--erp-border)" }}>
          <div style={sectionTitle}>③ Datos de factura</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={lbl}>Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={S} /></div>
            <div><label style={lbl}>N° Factura</label><input value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="Ej: 0045" style={S} /></div>
            <div>
              <label style={lbl}>Tasa del día (Bs/$)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="number" value={tasaDia} onChange={e => setTasaDia(e.target.value)} placeholder="0.00" style={S} />
                <button type="button" onClick={() => handleConsultarTasaBcv()} disabled={consultandoTasa}
                  style={{ flexShrink: 0, background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: consultandoTasa ? "not-allowed" : "pointer" }}>
                  {consultandoTasa ? "..." : "BCV"}
                </button>
              </div>
              {tasaBcvFecha && <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 3 }}>BCV: {tasaBcvFecha}</div>}
              {tasaBcvError && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 3 }}>{tasaBcvError}</div>}
            </div>
            <div>
              <label style={lbl}>Vencimiento pago</label>
              <input type="date" value={fechaVencimientoPago} onChange={e => setFechaVencimientoPago(e.target.value)} style={S} />
              {proveedorDiasCredito > 0 && <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 3 }}>{proveedorDiasCredito} días · según crédito del proveedor</div>}
            </div>
            <div style={{ gridColumn: "2 / -1" }}>
              <label style={lbl}>Observaciones</label>
              <input value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas internas, condiciones especiales…" style={S} />
            </div>
          </div>
        </div>

        {saveError && <div style={{ margin: "0 20px 12px", background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>{saveError}</div>}

        {/* Footer */}
        <div style={{ padding: "16px 20px", background: "var(--erp-bg)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: "0 0 12px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={onCancel} style={btnSecondary}>Cancelar</button>
            {items.some(it => it.nombreProducto.trim() && !it.productoId && it.showCreate) && (
              <div style={{ fontSize: 12, color: "var(--erp-text-3)" }}>⊕ Productos nuevos se crearán en inventario</div>
            )}
          </div>
          <button type="button" onClick={handleSubmit} disabled={saving || !proveedorQ.trim()} style={btnPrimary(saving || !proveedorQ.trim())}>
            {saving ? "Guardando..." : "💾 Registrar compra"}
          </button>
        </div>
      </div>
    </div>
  );
}

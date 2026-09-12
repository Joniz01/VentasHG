"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ESTADOS_GASTO,
  ESTADO_GASTO_LABELS,
  FRECUENCIAS_RECURRENCIA,
  FRECUENCIA_RECURRENCIA_LABELS,
  TIPOS_GASTO,
  type EstadoGasto,
  type FrecuenciaRecurrencia,
  type Gasto,
  type GastoResumen,
  type Locacion,
  type TipoGasto,
  type TipoGastoCatalogo,
} from "@/lib/types";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

type RifTipo = "J" | "V" | "E" | "G";

function parseRif(fullRif: string | null | undefined): { tipo: RifTipo; numero: string } {
  if (!fullRif) return { tipo: "J", numero: "" };
  const m = fullRif.match(/^([JVEGjveg])-(.+)$/);
  if (m) return { tipo: m[1].toUpperCase() as RifTipo, numero: m[2] };
  return { tipo: "J", numero: fullRif };
}

const PAGE_SIZES = [5, 10, 20, 25];

type FormState = {
  tipoGastoId: string;
  tipo: TipoGasto;
  proveedor: string;
  proveedorTelefono: string;
  proveedorDireccion: string;
  descripcion: string;
  locacionId: string;
  centroCostoId: string;
  fecha: string;
  montoBs: string;
  montoUsd: string;
  tasaDia: string;
  estado: EstadoGasto;
  recurrente: boolean;
  frecuencia: FrecuenciaRecurrencia;
  numeroFactura: string;
  comprobanteUrl: string;
};

const EMPTY_FORM: FormState = {
  tipoGastoId: "",
  tipo: "OCASIONAL",
  proveedor: "",
  proveedorTelefono: "",
  proveedorDireccion: "",
  descripcion: "",
  locacionId: "",
  centroCostoId: "",
  fecha: today(),
  montoBs: "",
  montoUsd: "",
  tasaDia: "",
  estado: "PAGADO",
  recurrente: false,
  frecuencia: "MENSUAL",
  numeroFactura: "",
  comprobanteUrl: "",
};

type FacturaItem = { key: number; nombre: string; cantidad: string; costoUnitBs: string };
let itemKeySeq = 0;
const nextItemKey = () => ++itemKeySeq;

function formatFechaCorta(fecha: string): string {
  return fecha.slice(8, 10) + "/" + fecha.slice(5, 7) + "/" + fecha.slice(0, 4);
}

function formatMonto(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ESTADO_COLORES: Record<EstadoGasto, string> = {
  PENDIENTE: "#a16207",
  APROBADO: "#1d4ed8",
  PAGADO: "#15803d",
};

function StatTile({ label, value, valueBs, color }: { label: string; value: number; valueBs: number; color: string }) {
  return (
    <div className="rounded-xl border px-4 py-3 flex-1 min-w-[160px]" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
      <div className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>{label}</div>
      <div className="text-xl font-extrabold" style={{ color }}>${formatMonto(value)}</div>
      <div className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>Bs{formatMonto(valueBs)}</div>
    </div>
  );
}

export default function GastosClient() {
  const [items, setItems] = useState<Gasto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroTipoGastoId, setFiltroTipoGastoId] = useState("");
  const [filtroNaturaleza, setFiltroNaturaleza] = useState<"" | "FIJO" | "OCASIONAL">("");

  const [tiposGasto, setTiposGasto] = useState<TipoGastoCatalogo[]>([]);
  const [locaciones, setLocaciones] = useState<Locacion[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<{ id: number; nombre: string }[]>([]);
  const [resumen, setResumen] = useState<GastoResumen>({ gastoHoy: 0, gastoHoyBs: 0, gastoMes: 0, gastoMesBs: 0, pendientePorPagar: 0, pendientePorPagarBs: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [nuevaLocacion, setNuevaLocacion] = useState("");
  const [rifTipo, setRifTipo] = useState<RifTipo>("J");
  const [rifNumero, setRifNumero] = useState("");
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null);

  const [showCargaFactura, setShowCargaFactura] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrProvider, setOcrProvider] = useState<string | null>(null);
  const [ocrVerif, setOcrVerif] = useState<{ reintentado: boolean; reintentoFallo: string | null; totalFactura: number; sumaItems: number; coincide: boolean } | null>(null);
  const [facturaItems, setFacturaItems] = useState<FacturaItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [montoBsFocus, setMontoBsFocus] = useState(false);
  const [montoUsdFocus, setMontoUsdFocus] = useState(false);
  const [consultandoTasa, setConsultandoTasa] = useState(false);
  const [tasaBcvFecha, setTasaBcvFecha] = useState<string | null>(null);
  const [tasaBcvError, setTasaBcvError] = useState<string | null>(null);

  async function handleConsultarTasaBcv() {
    setTasaBcvError(null);
    setConsultandoTasa(true);
    try {
      const res = await fetch("/api/tasa-bcv");
      const data = await res.json();
      if (!res.ok) throw new Error(data.detalle ? `${data.error}: ${data.detalle}` : (data.error ?? "No se pudo consultar la tasa BCV"));
      setForm((p) => ({ ...p, tasaDia: String(data.tasa) }));
      setTasaBcvFecha(data.fecha);
    } catch (err) {
      setTasaBcvError(err instanceof Error ? err.message : "No se pudo consultar la tasa BCV");
    } finally {
      setConsultandoTasa(false);
    }
  }

  const fechaFetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showForm) return;
    if (fechaFetchedRef.current === form.fecha) return;
    fechaFetchedRef.current = form.fecha;
    (async () => {
      try {
        const res = await fetch(`/api/tasa-bcv?fecha=${form.fecha}`);
        const data = res.ok ? await res.json() : null;
        if (data?.tasa) {
          setForm((p) => ({ ...p, tasaDia: String(data.tasa) }));
          setTasaBcvFecha(data.fecha);
        } else if (form.fecha !== today()) {
          // No hay tasa guardada para esa fecha pasada: dejar vacío en vez de
          // arrastrar la tasa de otra fecha (ej. la del día actual).
          setForm((p) => ({ ...p, tasaDia: "" }));
          setTasaBcvFecha(null);
        }
      } catch { /* ignore */ }
    })();
  }, [showForm, form.fecha]);

  const [recordatorios, setRecordatorios] = useState<
    { id: number; proveedor: string; tipoGastoNombre: string; montoBs: number; proximoRecordatorio: string }[]
  >([]);

  // ── Tab state ────────────────────────────────────────────────────────────
  type TabKey = "ocasionales" | "recurrentes";
  const [tab, setTab] = useState<TabKey>("ocasionales");

  type CxPRecurrente = {
    id: number; proveedor: string; frecuencia: string | null;
    fechaVencimiento: string; montoUsd: number; montoBs: number; estado: string;
    descripcion: string | null;
  };
  const EMPTY_REC_FORM = { proveedor: "", montoUsd: "", frecuencia: "MENSUAL", fechaVencimiento: "", descripcion: "" };
  const [recurrentes, setRecurrentes] = useState<CxPRecurrente[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [showFormRec, setShowFormRec] = useState(false);
  const [recForm, setRecForm] = useState({ ...EMPTY_REC_FORM });
  const [savingRec, setSavingRec] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const [editRecModal, setEditRecModal] = useState<CxPRecurrente | null>(null);
  const [editRecForm, setEditRecForm] = useState({ ...EMPTY_REC_FORM });
  const [savingEditRec, setSavingEditRec] = useState(false);
  const [editRecError, setEditRecError] = useState<string | null>(null);

  function abrirEditarRec(rec: CxPRecurrente) {
    setEditRecModal(rec);
    setEditRecForm({
      proveedor: rec.proveedor,
      montoUsd: rec.montoUsd > 0 ? String(rec.montoUsd) : "",
      frecuencia: rec.frecuencia ?? "MENSUAL",
      fechaVencimiento: rec.fechaVencimiento,
      descripcion: rec.descripcion ?? "",
    });
    setEditRecError(null);
  }

  async function handleGuardarEditRec() {
    if (!editRecModal) return;
    if (!editRecForm.proveedor.trim()) { setEditRecError("El nombre es obligatorio"); return; }
    if (!editRecForm.fechaVencimiento) { setEditRecError("Indica el vencimiento"); return; }
    setEditRecError(null);
    setSavingEditRec(true);
    try {
      const montoUsd = Number(editRecForm.montoUsd) || 0;
      const r = await fetch(`/api/cuentas-pagar/${editRecModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor: editRecForm.proveedor.trim(),
          descripcion: editRecForm.descripcion?.trim() || undefined,
          fechaVencimiento: editRecForm.fechaVencimiento,
          montoUsd,
          montoBs: montoUsd,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setEditRecError(j.error ?? "Error al guardar"); return; }
      setEditRecModal(null);
      fetchRecurrentes();
    } catch { setEditRecError("Error de conexión"); }
    finally { setSavingEditRec(false); }
  }

  async function fetchRecurrentes() {
    setLoadingRec(true);
    try {
      const r = await fetch("/api/cuentas-pagar?recurrente=true&pageSize=100&estado=PENDIENTE");
      const data = await r.json();
      setRecurrentes(data.items ?? []);
    } catch { /* ignore */ }
    finally { setLoadingRec(false); }
  }

  useEffect(() => {
    if (tab === "recurrentes") fetchRecurrentes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleGuardarRec() {
    if (!recForm.proveedor.trim()) { setRecError("El nombre del servicio es obligatorio"); return; }
    if (!recForm.fechaVencimiento) { setRecError("Indica el próximo vencimiento"); return; }
    setRecError(null);
    setSavingRec(true);
    try {
      const r = await fetch("/api/cuentas-pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor: recForm.proveedor.trim(),
          descripcion: recForm.descripcion?.trim() || undefined,
          fechaEmision: today(),
          fechaVencimiento: recForm.fechaVencimiento,
          montoUsd: Number(recForm.montoUsd) || 0,
          montoBs: 0,
          recurrente: true,
          frecuencia: recForm.frecuencia,
          estado: "PENDIENTE",
        }),
      });
      const j = await r.json();
      if (!r.ok) { setRecError(j.error ?? "Error al guardar"); return; }
      setShowFormRec(false);
      setRecForm({ ...EMPTY_REC_FORM });
      fetchRecurrentes();
    } catch { setRecError("Error de conexión"); }
    finally { setSavingRec(false); }
  }

  const totalFacturaBs = facturaItems.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0), 0);
  const totalFacturaUsd = Number(form.tasaDia) > 0 ? totalFacturaBs / Number(form.tasaDia) : 0;

  // Mantiene Monto Bs sincronizado con la suma de ítems mientras haya al menos uno cargado
  useEffect(() => {
    if (facturaItems.length === 0) return;
    setForm((p) => ({ ...p, montoBs: totalFacturaBs > 0 ? String(totalFacturaBs) : p.montoBs }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalFacturaBs, facturaItems.length]);

  // Recalcula Monto $ cuando cambia la tasa o el Monto Bs (ej. tasa cargada después de
  // escribir el monto, o Monto Bs completado por el OCR / la tabla de ítems)
  useEffect(() => {
    const tasa = Number(form.tasaDia) || 0;
    const bs = Number(form.montoBs) || 0;
    const usd = tasa > 0 && bs > 0 ? (bs / tasa).toFixed(2) : "";
    setForm((p) => (p.montoUsd === usd ? p : { ...p, montoUsd: usd }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tasaDia, form.montoBs]);

  function updateFacturaItem(key: number, cambios: Partial<FacturaItem>) {
    setFacturaItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...cambios } : it)));
  }

  function removeFacturaItem(key: number) {
    setFacturaItems((prev) => prev.filter((it) => it.key !== key));
  }

  function addFacturaItem() {
    setFacturaItems((prev) => [...prev, { key: nextItemKey(), nombre: "", cantidad: "1", costoUnitBs: "" }]);
  }

  async function loadGastos() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      if (filtroProveedor) params.set("proveedor", filtroProveedor);
      if (filtroTipoGastoId) params.set("tipoGastoId", filtroTipoGastoId);
      if (filtroNaturaleza) params.set("tipoNaturaleza", filtroNaturaleza);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/gastos?${params.toString()}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("No se pudieron cargar los gastos");
    } finally {
      setLoading(false);
    }
  }

  async function loadTiposGasto() {
    const res = await fetch("/api/tipos-gasto");
    if (res.ok) setTiposGasto(await res.json());
  }

  async function loadLocaciones() {
    const res = await fetch("/api/locaciones");
    if (res.ok) setLocaciones(await res.json());
  }

  async function loadResumen() {
    const res = await fetch("/api/gastos/resumen");
    if (res.ok) setResumen(await res.json());
  }

  async function loadRecordatorios() {
    try {
      const res = await fetch("/api/gastos/recordatorios");
      const data = await res.json();
      setRecordatorios(data.items ?? []);
    } catch {
      setRecordatorios([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTiposGasto();
    loadLocaciones();
    loadResumen();
    loadRecordatorios();
    fetch("/api/centros-costo").then((r) => r.ok && r.json()).then((d) => { if (d) setCentrosCosto(d); });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGastos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filtroDesde, filtroHasta, filtroProveedor, filtroTipoGastoId, filtroNaturaleza]);

  function tipoGastoIdPorDefecto(): string {
    const operativo = tiposGasto.find((t) => t.nombre === "Gasto Operativo");
    return operativo ? String(operativo.id) : "";
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, tipoGastoId: tipoGastoIdPorDefecto() });
    setRifTipo("J");
    setRifNumero("");
    setShowForm(false);
    setShowCargaFactura(false);
    setOcrError(null);
    setOcrProvider(null);
    setOcrVerif(null);
    setFacturaItems([]);
    setTasaBcvFecha(null);
    setTasaBcvError(null);
    fechaFetchedRef.current = null;
  }

  function startEdit(g: Gasto) {
    setEditingId(g.id);
    setForm({
      tipoGastoId: String(g.tipoGastoId),
      tipo: g.tipo,
      proveedor: g.proveedor,
      proveedorTelefono: g.proveedorTelefono ?? "",
      proveedorDireccion: g.proveedorDireccion ?? "",
      descripcion: g.descripcion ?? "",
      locacionId: g.locacionId ? String(g.locacionId) : "",
      centroCostoId: g.centroCostoId ? String(g.centroCostoId) : "",
      fecha: g.fecha,
      montoBs: String(g.montoBs),
      montoUsd: Number(g.tasaDia) > 0 ? (Number(g.montoBs) / Number(g.tasaDia)).toFixed(2) : "",
      tasaDia: String(g.tasaDia),
      estado: g.estado,
      recurrente: g.recurrente,
      frecuencia: g.frecuencia ?? "MENSUAL",
      numeroFactura: g.numeroFactura ?? "",
      comprobanteUrl: g.comprobanteUrl ?? "",
    });
    const parsed = parseRif(g.proveedorRif);
    setRifTipo(parsed.tipo);
    setRifNumero(parsed.numero);
    setFacturaItems([]);
    setShowCargaFactura(false);
    fechaFetchedRef.current = g.fecha; // no sobrescribir la tasa ya guardada al editar
    setShowForm(true);
  }

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
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ dataUrl, base64: dataUrl.split(",")[1] });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

  async function handleCargaFacturaFile(file: File) {
    setOcrError(null);
    setOcrProvider(null);
    setOcrVerif(null);
    setOcrLoading(true);
    try {
      const { dataUrl, base64 } = await compressImage(file);
      setForm((p) => ({ ...p, comprobanteUrl: dataUrl }));

      const res = await fetch("/api/compras/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const clean = (v: unknown): string => {
        if (!v || v === "null" || v === "undefined") return "";
        return String(v).trim();
      };

      const proveedor = clean(d.proveedorNombre);
      const proveedorRif = clean(d.proveedorRif);
      const proveedorTelefono = clean(d.proveedorTelefono);
      const proveedorDireccion = clean(d.proveedorDireccion);
      const numeroFactura = clean(d.numeroFactura);
      const fecha = clean(d.fecha);
      const ocrItems: { nombre?: string; cantidad?: number; costoUnitBs?: number }[] = Array.isArray(d.items) ? d.items : [];
      const mappedItems = ocrItems
        .map((it) => {
          const nombre = clean(it.nombre);
          if (!nombre) return null;
          return {
            key: nextItemKey(),
            nombre,
            cantidad: String(Number(it.cantidad) || 1),
            costoUnitBs: Number(it.costoUnitBs) > 0 ? String(it.costoUnitBs) : "",
          };
        })
        .filter((it): it is FacturaItem => it !== null);
      const total = mappedItems.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0), 0);

      if (mappedItems.length > 0) setFacturaItems(mappedItems);
      if (proveedorRif) { const p = parseRif(proveedorRif); setRifTipo(p.tipo); setRifNumero(p.numero); }

      setForm((p) => ({
        ...p,
        proveedor: proveedor || p.proveedor,
        proveedorTelefono: proveedorTelefono || p.proveedorTelefono,
        proveedorDireccion: proveedorDireccion || p.proveedorDireccion,
        numeroFactura: numeroFactura || p.numeroFactura,
        fecha: fecha && fecha !== "null" ? fecha.slice(0, 10) : p.fecha,
        montoBs: total > 0 ? String(total) : p.montoBs,
      }));
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Error al procesar la factura");
    } finally {
      setOcrLoading(false);
    }
  }

  function updateMontoBs(bsVal: string) {
    const bs = Number(bsVal) || 0;
    const tasa = Number(form.tasaDia) || 0;
    const usd = tasa > 0 ? (bs / tasa).toFixed(2) : "";
    setForm((p) => ({ ...p, montoBs: bsVal, montoUsd: usd }));
  }

  function updateMontoUsd(usdVal: string) {
    const usd = Number(usdVal) || 0;
    const tasa = Number(form.tasaDia) || 0;
    const bs = tasa > 0 ? (usd * tasa).toFixed(2) : "";
    setForm((p) => ({ ...p, montoUsd: usdVal, montoBs: bs }));
  }

  async function handleAgregarLocacion() {
    const nombre = nuevaLocacion.trim();
    if (!nombre) return;
    const res = await fetch("/api/locaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (res.ok) {
      const loc = await res.json();
      setLocaciones((prev) => [...prev, loc].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm((p) => ({ ...p, locacionId: String(loc.id) }));
      setNuevaLocacion("");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.tipoGastoId) {
      setError("Selecciona el tipo de gasto");
      return;
    }
    if (!form.proveedor.trim()) {
      setError("Indica el proveedor / gasto");
      return;
    }
    if (form.recurrente && !form.frecuencia) {
      setError("Indica la frecuencia de recurrencia");
      return;
    }

    setSaving(true);
    try {
      const fullRif = rifNumero.trim() ? `${rifTipo}-${rifNumero.trim()}` : "";
      const payload = {
        tipoGastoId: Number(form.tipoGastoId),
        tipo: form.tipo,
        proveedor: form.proveedor.trim(),
        proveedorRif: fullRif,
        proveedorTelefono: form.proveedorTelefono.trim(),
        proveedorDireccion: form.proveedorDireccion.trim(),
        descripcion: form.descripcion.trim(),
        locacionId: form.locacionId ? Number(form.locacionId) : null,
        centroCostoId: form.centroCostoId ? Number(form.centroCostoId) : null,
        fecha: form.fecha,
        montoBs: Number(form.montoBs) || 0,
        tasaDia: Number(form.tasaDia) || 0,
        estado: form.estado,
        recurrente: form.recurrente,
        frecuencia: form.recurrente ? form.frecuencia : null,
        numeroFactura: form.numeroFactura.trim(),
        comprobanteUrl: form.comprobanteUrl,
      };

      const res = await fetch(editingId ? `/api/gastos/${editingId}` : "/api/gastos", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detalle ? `${data.error}: ${data.detalle}` : (data.error ?? "Error al guardar el gasto"));

      resetForm();
      await loadGastos();
      await loadResumen();
      await loadRecordatorios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el gasto");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este gasto?")) return;
    const res = await fetch(`/api/gastos/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadGastos();
      await loadResumen();
    }
  }

  async function handleCambiarEstado(g: Gasto, estado: EstadoGasto) {
    await fetch(`/api/gastos/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoGastoId: g.tipoGastoId,
        tipo: g.tipo,
        proveedor: g.proveedor,
        descripcion: g.descripcion,
        locacionId: g.locacionId,
        fecha: g.fecha,
        montoBs: g.montoBs,
        tasaDia: g.tasaDia,
        estado,
        recurrente: g.recurrente,
        frecuencia: g.frecuencia,
        numeroFactura: g.numeroFactura,
        comprobanteUrl: g.comprobanteUrl,
      }),
    });
    await loadGastos();
    await loadResumen();
  }

  async function handleDescartarRecordatorio(id: number) {
    const g = items.find((x) => x.id === id);
    if (!g) {
      await loadRecordatorios();
      return;
    }
    await fetch(`/api/gastos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoGastoId: g.tipoGastoId,
        tipo: g.tipo,
        proveedor: g.proveedor,
        descripcion: g.descripcion,
        locacionId: g.locacionId,
        fecha: g.fecha,
        montoBs: g.montoBs,
        tasaDia: g.tasaDia,
        estado: g.estado,
        recurrente: g.recurrente,
        frecuencia: g.frecuencia,
        numeroFactura: g.numeroFactura,
        comprobanteUrl: g.comprobanteUrl,
        recordatorioVisto: true,
      }),
    });
    await loadRecordatorios();
  }

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const recInputStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, border: "1px solid var(--erp-border)",
    background: "var(--erp-bg)", color: "var(--erp-text)", fontSize: 13, width: "100%",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tab nav */}
      <div style={{ display: "flex", borderBottom: "1.5px solid var(--erp-border)", gap: 0, marginBottom: -4 }}>
        {([
          { key: "ocasionales" as TabKey, label: "Ocasionales" },
          { key: "recurrentes" as TabKey, label: "🔁 Recurrentes" },
        ]).map(t => (
          <button key={t.key} type="button"
            onClick={() => { setTab(t.key); setShowForm(false); setShowFormRec(false); }}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 700, background: "transparent",
              border: "none", cursor: "pointer",
              borderBottom: tab === t.key ? "2.5px solid var(--erp-accent)" : "2.5px solid transparent",
              color: tab === t.key ? "var(--erp-accent)" : "var(--erp-text-3)",
              marginBottom: -1.5,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ocasionales" && (<>
      {recordatorios.length > 0 && (
        <div
          className="rounded-lg border p-3 flex flex-col gap-2"
          style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>
            🔔 Recordatorio de gastos recurrentes
          </span>
          {recordatorios.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--erp-text-2)" }}>
              <span>
                <strong>{r.proveedor}</strong> ({r.tipoGastoNombre}) — vence {formatFechaCorta(r.proximoRecordatorio)}
              </span>
              <button
                type="button"
                onClick={() => handleDescartarRecordatorio(r.id)}
                className="rounded-md border px-2 py-1 text-xs font-medium"
                style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
              >
                Descartar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <StatTile label="Gasto Hoy" value={resumen.gastoHoy} valueBs={resumen.gastoHoyBs} color="var(--erp-text)" />
        <StatTile label="Gasto del Mes" value={resumen.gastoMes} valueBs={resumen.gastoMesBs} color="var(--erp-text)" />
        <StatTile label="Pendiente por Pagar" value={resumen.pendientePorPagar} valueBs={resumen.pendientePorPagarBs} color="#a16207" />
      </div>

      <div className="flex justify-end gap-2 flex-wrap">
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM, tipoGastoId: tipoGastoIdPorDefecto() });
              setEditingId(null);
              setFacturaItems([]);
              setShowCargaFactura(false);
              fechaFetchedRef.current = null;
              setShowForm(true);
            }}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--erp-accent)" }}
          >
            + Registrar Gasto
          </button>
        )}
        {showForm && (
          <>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--erp-accent)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCargaFactura((v) => {
                  const next = !v;
                  if (next && facturaItems.length === 0) {
                    setFacturaItems([{ key: nextItemKey(), nombre: "", cantidad: "1", costoUnitBs: "" }]);
                  }
                  return next;
                });
              }}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={showCargaFactura
                ? { background: "var(--erp-primary)", color: "#fff", border: "1px solid var(--erp-primary)" }
                : { border: "1px solid var(--erp-primary)", color: "var(--erp-primary)", background: "var(--erp-surface)" }}
            >
              📷 {showCargaFactura ? "Ocultar factura" : "Cargar Factura"}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
        >
          {showCargaFactura && (
            <div
              className="rounded-lg p-3 flex flex-col gap-2"
              style={{ background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)" }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-medium flex-1 min-w-0 truncate" style={{ color: "var(--erp-text)" }}>
                  📷 Escanear / Cargar
                </span>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="shrink-0 rounded-md px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-white whitespace-nowrap"
                  style={{ background: "var(--erp-primary)" }}
                >
                  📸 Cámara
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="shrink-0 rounded-md border px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold whitespace-nowrap"
                  style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)", background: "var(--erp-surface)" }}
                >
                  ⬆ Subir
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {ocrLoading && <span className="text-xs" style={{ color: "var(--erp-text-2)" }}>Analizando factura…</span>}
                {!ocrLoading && form.comprobanteUrl && !ocrError && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "var(--erp-surface)", color: "var(--erp-primary)", border: "1px solid var(--erp-border)" }}
                  >
                    ✓ Procesada — revisa y completa los faltantes
                  </span>
                )}
                {ocrProvider && (
                  <span className="text-xs font-semibold" style={{ color: "var(--erp-text-3)" }}>
                    vía {ocrProvider === "gemini" ? "Gemini" : "Groq"}
                  </span>
                )}
              </div>
              {ocrError && <span className="text-xs" style={{ color: "#B91C1C" }}>⚠ {ocrError}</span>}
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleCargaFacturaFile(e.target.files[0]); }}
              />
              <input
                ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleCargaFacturaFile(e.target.files[0]); }}
              />
              {form.comprobanteUrl && !ocrLoading && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.comprobanteUrl}
                  alt="Factura"
                  onClick={() => setImagenAmpliada(form.comprobanteUrl)}
                  className="rounded-md border max-h-40 object-contain cursor-zoom-in"
                  style={{ borderColor: "var(--erp-border)" }}
                />
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>Ítems de la factura</span>
                <span className="text-xs" style={{ color: "var(--erp-text-3)" }}>{facturaItems.length} línea{facturaItems.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th className="text-left px-1 py-1" style={{ color: "var(--erp-text-3)" }}>Producto</th>
                      <th className="text-left px-1 py-1 w-16" style={{ color: "var(--erp-text-3)" }}>Cant.</th>
                      <th className="text-left px-1 py-1 w-24" style={{ color: "var(--erp-text-3)" }}>Bs</th>
                      <th className="text-right px-1 py-1 w-24" style={{ color: "var(--erp-text-3)" }}>Subtotal</th>
                      <th className="w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturaItems.map((it) => (
                      <tr key={it.key} style={{ borderTop: "1px solid var(--erp-border)" }}>
                        <td className="px-1 py-1">
                          <input
                            className="rounded border px-1.5 py-1 text-xs w-full"
                            style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}
                            value={it.nombre}
                            onChange={(e) => updateFacturaItem(it.key, { nombre: e.target.value })}
                            placeholder="Nombre del producto"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number" min="0" step="0.01"
                            className="rounded border px-1.5 py-1 text-xs w-full"
                            style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}
                            value={it.cantidad}
                            onChange={(e) => updateFacturaItem(it.key, { cantidad: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number" min="0" step="0.01"
                            className="rounded border px-1.5 py-1 text-xs w-full"
                            style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}
                            value={it.costoUnitBs}
                            onChange={(e) => updateFacturaItem(it.key, { costoUnitBs: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1 text-right font-semibold" style={{ color: "var(--erp-text)" }}>
                          {formatMonto((Number(it.cantidad) || 0) * (Number(it.costoUnitBs) || 0))}
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeFacturaItem(it.key)}
                            disabled={facturaItems.length === 1}
                            className="text-xs disabled:opacity-30"
                            style={{ color: "#B91C1C" }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                onClick={addFacturaItem}
                className="text-xs font-semibold rounded-md border-dashed border py-1.5 text-center"
                style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}
              >
                ＋ Agregar ítem
              </button>

              {facturaItems.length > 0 && (
                <div className="flex justify-end gap-5 pt-2" style={{ borderTop: "1px solid var(--erp-border)" }}>
                  {Number(form.tasaDia) > 0 && (
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Total USD</div>
                      <div className="text-base font-extrabold" style={{ color: "var(--erp-primary)" }}>${formatMonto(totalFacturaUsd)}</div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Total Bs</div>
                    <div className="text-base font-extrabold" style={{ color: "var(--erp-text)" }}>Bs{formatMonto(totalFacturaBs)}</div>
                  </div>
                </div>
              )}
              {form.comprobanteUrl && (
                <div className="text-right text-xs" style={{ color: "#B45309" }}>
                  ⚠ Verifica los costos de cada ítem contra la factura física antes de guardar
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: "var(--erp-bg)", border: "1px solid var(--erp-border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>Datos del proveedor</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Gasto / Proveedor</label>
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.proveedor}
                  onChange={(e) => setForm((p) => ({ ...p, proveedor: e.target.value }))}
                  placeholder="Ej: Simple Fibra"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>RIF / C.I.</label>
                <div className="flex">
                  <div className="flex rounded-l-md border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
                    {(["J", "V", "E", "G"] as RifTipo[]).map((t, i, arr) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRifTipo(t)}
                        className="text-sm font-bold px-2.5 py-2"
                        style={{
                          background: rifTipo === t ? "var(--erp-primary)" : "var(--erp-surface)",
                          color: rifTipo === t ? "#fff" : "var(--erp-text-2)",
                          borderRight: i < arr.length - 1 ? "1px solid var(--erp-border)" : "none",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    className="rounded-r-md border px-3 py-2 text-sm flex-1 min-w-0"
                    style={{ borderColor: "var(--erp-border)", borderLeft: "none" }}
                    value={rifNumero}
                    onChange={(e) => setRifNumero(e.target.value.replace(/[^0-9\-]/g, ""))}
                    placeholder="12345678-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Teléfono</label>
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.proveedorTelefono}
                  onChange={(e) => setForm((p) => ({ ...p, proveedorTelefono: e.target.value }))}
                  placeholder="0412-0000000"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>N° Factura</label>
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.numeroFactura}
                  onChange={(e) => setForm((p) => ({ ...p, numeroFactura: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Dirección</label>
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.proveedorDireccion}
                  onChange={(e) => setForm((p) => ({ ...p, proveedorDireccion: e.target.value }))}
                  placeholder="Dirección del proveedor"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Tipo de gasto</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.tipoGastoId}
                onChange={(e) => setForm((p) => ({ ...p, tipoGastoId: e.target.value }))}
                required
              >
                <option value="">Selecciona…</option>
                {tiposGasto.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Fijo / Ocasional</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoGasto }))}
              >
                {TIPOS_GASTO.map((t) => (
                  <option key={t} value={t}>{t === "FIJO" ? "Fijo" : "Ocasional"}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Estado</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.estado}
                onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as EstadoGasto }))}
              >
                {ESTADOS_GASTO.map((s) => (
                  <option key={s} value={s}>{ESTADO_GASTO_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Descripción</label>
            <input
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: "var(--erp-border)" }}
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Ej: Servicio de Internet"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Locación</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.locacionId}
                onChange={(e) => setForm((p) => ({ ...p, locacionId: e.target.value }))}
              >
                <option value="">—</option>
                {locaciones.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
              <div className="flex gap-1 mt-1">
                <input
                  className="rounded-md border px-2 py-1 text-xs flex-1"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={nuevaLocacion}
                  onChange={(e) => setNuevaLocacion(e.target.value)}
                  placeholder="Nueva locación"
                />
                <button type="button" onClick={handleAgregarLocacion} className="text-xs px-2 rounded-md border" style={{ borderColor: "var(--erp-border)" }}>
                  +
                </button>
              </div>
            </div>
            {centrosCosto.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Centro de Costo</label>
                <select
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.centroCostoId}
                  onChange={(e) => setForm((p) => ({ ...p, centroCostoId: e.target.value }))}
                >
                  <option value="">— Sin asignar —</option>
                  {centrosCosto.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Fecha</label>
              <input
                type="date"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                required
              />
              {form.fecha && (
                <span className="text-xs" style={{ color: "var(--erp-text-3)" }}>{formatFechaCorta(form.fecha)}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Monto Bs</label>
              <input
                type="text"
                inputMode="decimal"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={montoBsFocus ? form.montoBs : (form.montoBs ? formatMonto(Number(form.montoBs) || 0) : "")}
                onFocus={() => setMontoBsFocus(true)}
                onBlur={() => setMontoBsFocus(false)}
                onChange={(e) => updateMontoBs(e.target.value.replace(/,/g, ""))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Monto $</label>
              <input
                type="text"
                inputMode="decimal"
                className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                style={{ borderColor: "var(--erp-border)" }}
                value={montoUsdFocus ? form.montoUsd : (form.montoUsd ? formatMonto(Number(form.montoUsd) || 0) : "")}
                onFocus={() => setMontoUsdFocus(true)}
                onBlur={() => setMontoUsdFocus(false)}
                onChange={(e) => updateMontoUsd(e.target.value.replace(/,/g, ""))}
                disabled={!(Number(form.tasaDia) > 0)}
                placeholder={Number(form.tasaDia) > 0 ? "0.00" : "Carga la tasa primero"}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Tasa del día</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  className="rounded-md border px-3 py-2 text-sm flex-1 min-w-0"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.tasaDia}
                  onChange={(e) => setForm((p) => ({ ...p, tasaDia: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={handleConsultarTasaBcv}
                  disabled={consultandoTasa}
                  className="shrink-0 rounded-md border px-2 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)", background: "var(--erp-primary-lt)" }}
                >
                  {consultandoTasa ? "..." : "BCV"}
                </button>
              </div>
              {tasaBcvFecha && <span className="text-xs" style={{ color: "var(--erp-text-3)" }}>BCV: {tasaBcvFecha}</span>}
              {tasaBcvError && <span className="text-xs" style={{ color: "#B91C1C" }}>{tasaBcvError}</span>}
            </div>
          </div>

          {/* Recurrencia deshabilitada — los gastos recurrentes se gestionan en Cuentas por Pagar */}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--erp-primary)" }}
            >
              {saving ? "Guardando..." : editingId ? "Actualizar Gasto" : "Guardar Gasto"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border p-3 flex flex-wrap gap-3 items-end" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Desde</label>
          <input
            type="date"
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroDesde}
            onChange={(e) => { setFiltroDesde(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Hasta</label>
          <input
            type="date"
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroHasta}
            onChange={(e) => { setFiltroHasta(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Proveedor</label>
          <input
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroProveedor}
            onChange={(e) => { setFiltroProveedor(e.target.value); setPage(1); }}
            placeholder="Buscar proveedor…"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Tipo de gasto</label>
          <select
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroTipoGastoId}
            onChange={(e) => { setFiltroTipoGastoId(e.target.value); setPage(1); }}
          >
            <option value="">Todos</option>
            {tiposGasto.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Naturaleza</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["", "FIJO", "OCASIONAL"] as const).map((v) => {
              const label = v === "" ? "Todos" : v === "FIJO" ? "Fijos" : "Ocasionales";
              const active = filtroNaturaleza === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setFiltroNaturaleza(v); setPage(1); }}
                  style={{
                    padding: "5px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${active ? "var(--erp-primary)" : "var(--erp-border)"}`,
                    background: active ? "var(--erp-primary)" : "transparent",
                    color: active ? "#fff" : "var(--erp-text-2)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {(filtroDesde || filtroHasta || filtroProveedor || filtroTipoGastoId || filtroNaturaleza) && (
          <button
            type="button"
            onClick={() => { setFiltroDesde(""); setFiltroHasta(""); setFiltroProveedor(""); setFiltroTipoGastoId(""); setFiltroNaturaleza(""); setPage(1); }}
            className="text-xs px-3 py-1.5 rounded-md border"
            style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)", color: "var(--erp-text)" }}
        >
          Sin gastos registrados.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--erp-text-2)" }}>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Tipo de gasto</th>
                  <th className="text-left px-3 py-2">Gasto/Proveedor</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-left px-3 py-2">Locación</th>
                  <th className="text-right px-3 py-2">Monto Bs</th>
                  <th className="text-right px-3 py-2">Monto $</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                    <td className="px-3 py-2">{formatFechaCorta(g.fecha)}</td>
                    <td className="px-3 py-2">{g.tipoGastoNombre}</td>
                    <td className="px-3 py-2" style={{ color: "var(--erp-text)" }}>
                      {g.proveedor} {g.recurrente && <span title="Recurrente">🔁</span>}
                    </td>
                    <td className="px-3 py-2">{g.tipo === "FIJO" ? "Fijo" : "Ocasional"}</td>
                    <td className="px-3 py-2">{g.descripcion}</td>
                    <td className="px-3 py-2">{g.locacionNombre ?? "—"}</td>
                    <td className="px-3 py-2 text-right">Bs{formatMonto(g.montoBs)}</td>
                    <td className="px-3 py-2 text-right">${formatMonto(g.montoUsd)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={g.estado}
                        onChange={(e) => handleCambiarEstado(g, e.target.value as EstadoGasto)}
                        className="rounded-md border px-2 py-1 text-xs font-semibold"
                        style={{ borderColor: "var(--erp-border)", color: ESTADO_COLORES[g.estado] }}
                      >
                        {ESTADOS_GASTO.map((s) => (
                          <option key={s} value={s}>{ESTADO_GASTO_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(g)} className="text-xs" style={{ color: "var(--erp-primary)" }}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleEliminar(g.id)} className="text-xs text-red-600">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 border-t text-xs" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border px-2 py-1"
                style={{ borderColor: "var(--erp-border)" }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>de {total} gastos</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-2 py-1 disabled:opacity-40" style={{ borderColor: "var(--erp-border)" }}>
                ←
              </button>
              <span>Página {page} de {totalPaginas}</span>
              <button type="button" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-2 py-1 disabled:opacity-40" style={{ borderColor: "var(--erp-border)" }}>
                →
              </button>
            </div>
          </div>
        </div>
      )}

      </>)}

      {tab === "recurrentes" && (
        <div className="flex flex-col gap-4">
          {/* Callout */}
          <div style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#2563EB", lineHeight: 1.5 }}>
            Los servicios configurados aquí aparecen en <strong>Cuentas por Pagar</strong> cuando entran en período de pago.
            Los gastos ocasionales pendientes de pago también se consolidan allí.
          </div>

          {/* Botón + form */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {!showFormRec && (
              <button type="button" onClick={() => setShowFormRec(true)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--erp-accent)" }}>
                + Configurar Servicio
              </button>
            )}
          </div>

          {showFormRec && (
            <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--erp-text)" }}>Nuevo Servicio Recurrente</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="text-xs font-semibold" style={{ color: "var(--erp-text-2)" }}>Nombre / Proveedor *</label>
                  <input type="text" value={recForm.proveedor} placeholder="Ej: Alquiler local"
                    onChange={e => setRecForm(p => ({ ...p, proveedor: e.target.value }))} style={recInputStyle} />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--erp-text-2)" }}>Frecuencia</label>
                  <select value={recForm.frecuencia} onChange={e => setRecForm(p => ({ ...p, frecuencia: e.target.value }))} style={recInputStyle}>
                    {FRECUENCIAS_RECURRENCIA.map(f => (
                      <option key={f} value={f}>{FRECUENCIA_RECURRENCIA_LABELS[f]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--erp-text-2)" }}>Monto USD (referencia)</label>
                  <input type="number" min="0" step="0.01" value={recForm.montoUsd} placeholder="0.00"
                    onChange={e => setRecForm(p => ({ ...p, montoUsd: e.target.value }))} style={recInputStyle} />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--erp-text-2)" }}>Próximo vencimiento *</label>
                  <input type="date" value={recForm.fechaVencimiento}
                    onChange={e => setRecForm(p => ({ ...p, fechaVencimiento: e.target.value }))} style={recInputStyle} />
                </div>
                <div>
                  <label className="text-xs font-semibold" style={{ color: "var(--erp-text-2)" }}>Descripción</label>
                  <input type="text" value={recForm.descripcion} placeholder="Opcional"
                    onChange={e => setRecForm(p => ({ ...p, descripcion: e.target.value }))} style={recInputStyle} />
                </div>
              </div>
              {recError && <p style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>{recError}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setShowFormRec(false); setRecForm({ ...EMPTY_REC_FORM }); setRecError(null); }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", cursor: "pointer", fontSize: 13, color: "var(--erp-text)" }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleGuardarRec} disabled={savingRec}
                  style={{ padding: "7px 14px", borderRadius: 8, background: "var(--erp-accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                  {savingRec ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {/* Lista */}
          {loadingRec ? (
            <p style={{ textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Cargando…</p>
          ) : recurrentes.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--erp-text-3)", fontSize: 13, padding: "2.5rem 0",
              border: "1px dashed var(--erp-border)", borderRadius: 12 }}>
              Sin servicios recurrentes configurados.<br />
              <span style={{ fontSize: 12 }}>Usa el botón + Configurar Servicio para agregar uno.</span>
            </div>
          ) : (
            <div style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}>
              {recurrentes.map((rec, idx) => (
                <div key={rec.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderBottom: idx < recurrentes.length - 1 ? "1px solid var(--erp-border)" : undefined }}>
                  <div style={{ fontSize: 18, width: 36, height: 36, borderRadius: 8, background: "var(--erp-bg)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🔧</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--erp-text)" }}>{rec.proveedor}</div>
                    {rec.descripcion && <div style={{ fontSize: 11, color: "var(--erp-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.descripcion}</div>}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: "var(--erp-bg)", border: "1px solid var(--erp-border)",
                        borderRadius: 4, padding: "1px 6px", color: "var(--erp-text-3)", textTransform: "uppercase" }}>
                        {FRECUENCIA_RECURRENCIA_LABELS[rec.frecuencia as FrecuenciaRecurrencia] ?? rec.frecuencia}
                      </span>
                      {rec.fechaVencimiento && (
                        <span style={{ fontSize: 11, fontWeight: 600,
                          color: rec.fechaVencimiento < today() ? "#EF4444" : "#D97706" }}>
                          Vence {formatFechaCorta(rec.fechaVencimiento)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      {rec.montoUsd > 0 && (
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--erp-text)" }}>
                          ${formatMonto(rec.montoUsd)}
                        </div>
                      )}
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 700,
                        background: rec.estado === "PENDIENTE" ? "rgba(217,119,6,0.10)" : "rgba(5,150,105,0.10)",
                        color: rec.estado === "PENDIENTE" ? "#D97706" : "#059669" }}>
                        {rec.estado === "PENDIENTE" ? "En período" : rec.estado}
                      </span>
                    </div>
                    <button type="button" onClick={() => abrirEditarRec(rec)}
                      style={{ padding: "5px 10px", borderRadius: 8, background: "transparent",
                        color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", fontSize: 13, cursor: "pointer" }}>
                      ✏️
                    </button>
                    <button type="button" onClick={async () => {
                        if (!confirm(`¿Eliminar "${rec.proveedor}"? Los pagos ya registrados no se verán afectados.`)) return;
                        const r = await fetch(`/api/gastos/${rec.id}`, { method: "DELETE" });
                        if (r.ok) fetchRecurrentes();
                      }}
                      style={{ padding: "5px 10px", borderRadius: 8, background: "transparent",
                        color: "#EF4444", border: "1px solid #EF4444", fontSize: 13, cursor: "pointer" }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Editar Recurrente */}
      {editRecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setEditRecModal(null)}>
          <div style={{ background: "var(--erp-surface)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "var(--erp-text)" }}>Editar Servicio Recurrente</h3>
            {editRecError && <p style={{ margin: "0 0 12px", color: "#EF4444", fontSize: 13 }}>{editRecError}</p>}
            {([
              { label: "Proveedor / Servicio", key: "proveedor", type: "text" },
              { label: "Monto USD", key: "montoUsd", type: "number" },
              { label: "Próximo vencimiento", key: "fechaVencimiento", type: "date" },
              { label: "Descripción", key: "descripcion", type: "text" },
            ] as { label: string; key: keyof typeof editRecForm; type: string }[]).map(({ label, key, type }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-text-2)", display: "block", marginBottom: 4 }}>{label}</label>
                <input type={type} value={String(editRecForm[key] ?? "")}
                  onChange={e => setEditRecForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "var(--erp-bg)", color: "var(--erp-text)", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-text-2)", display: "block", marginBottom: 4 }}>Frecuencia</label>
              <select value={editRecForm.frecuencia} onChange={e => setEditRecForm(p => ({ ...p, frecuencia: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "var(--erp-bg)", color: "var(--erp-text)", fontSize: 14 }}>
                <option value="MENSUAL">Mensual</option>
                <option value="QUINCENAL">Quincenal</option>
                <option value="SEMANAL">Semanal</option>
              </select>
            </div>
            <p style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 16 }}>
              ℹ️ Solo actualiza el período actual. El siguiente período se generará con estos valores al pagar.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setEditRecModal(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text-2)", fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" onClick={handleGuardarEditRec} disabled={savingEditRec}
                style={{ padding: "8px 20px", borderRadius: 8, background: "#D97706", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {savingEditRec ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {imagenAmpliada && (
        <div
          onClick={() => setImagenAmpliada(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", touchAction: "pinch-zoom" }}
        >
          <button
            type="button"
            onClick={() => setImagenAmpliada(null)}
            className="fixed top-3 right-4 text-3xl font-bold leading-none"
            style={{ color: "#fff" }}
            aria-label="Cerrar"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagenAmpliada}
            alt="Factura ampliada"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain"
            style={{ touchAction: "pinch-zoom" }}
          />
        </div>
      )}
    </div>
  );
}

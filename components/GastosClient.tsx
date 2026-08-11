"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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

const PAGE_SIZES = [5, 10, 20, 25];

type FormState = {
  tipoGastoId: string;
  tipo: TipoGasto;
  proveedor: string;
  descripcion: string;
  locacionId: string;
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
  descripcion: "",
  locacionId: "",
  fecha: today(),
  montoBs: "",
  montoUsd: "",
  tasaDia: "",
  estado: "PENDIENTE",
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

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border px-4 py-3 flex-1 min-w-[160px]" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
      <div className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>{label}</div>
      <div className="text-xl font-extrabold" style={{ color }}>${formatMonto(value)}</div>
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

  const [tiposGasto, setTiposGasto] = useState<TipoGastoCatalogo[]>([]);
  const [locaciones, setLocaciones] = useState<Locacion[]>([]);
  const [resumen, setResumen] = useState<GastoResumen>({ gastoHoy: 0, gastoMes: 0, pendientePorPagar: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [nuevaLocacion, setNuevaLocacion] = useState("");

  const [showCargaFactura, setShowCargaFactura] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrProvider, setOcrProvider] = useState<string | null>(null);
  const [ocrVerif, setOcrVerif] = useState<{ reintentado: boolean; totalFactura: number; sumaItems: number; coincide: boolean } | null>(null);
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
        if (!res.ok) return;
        const data = await res.json();
        if (data?.tasa) { setForm((p) => ({ ...p, tasaDia: String(data.tasa) })); setTasaBcvFecha(data.fecha); }
      } catch { /* ignore */ }
    })();
  }, [showForm, form.fecha]);

  const [recordatorios, setRecordatorios] = useState<
    { id: number; proveedor: string; tipoGastoNombre: string; montoBs: number; proximoRecordatorio: string }[]
  >([]);

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
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGastos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filtroDesde, filtroHasta, filtroProveedor, filtroTipoGastoId]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
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
      descripcion: g.descripcion ?? "",
      locacionId: g.locacionId ? String(g.locacionId) : "",
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
        totalFactura: Number(data._totalFactura) || 0,
        sumaItems: Number(data._sumaItems) || 0,
        coincide: data._coincide !== false,
      });

      const clean = (v: unknown): string => {
        if (!v || v === "null" || v === "undefined") return "";
        return String(v).trim();
      };

      const proveedor = clean(d.proveedorNombre);
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

      setForm((p) => ({
        ...p,
        proveedor: proveedor || p.proveedor,
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
      const payload = {
        tipoGastoId: Number(form.tipoGastoId),
        tipo: form.tipo,
        proveedor: form.proveedor.trim(),
        descripcion: form.descripcion.trim(),
        locacionId: form.locacionId ? Number(form.locacionId) : null,
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
      if (!res.ok) throw new Error(data.error ?? "Error al guardar el gasto");

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

  return (
    <div className="flex flex-col gap-4">
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
        <StatTile label="Gasto Hoy" value={resumen.gastoHoy} color="var(--erp-text)" />
        <StatTile label="Gasto del Mes" value={resumen.gastoMes} color="var(--erp-text)" />
        <StatTile label="Pendiente por Pagar" value={resumen.pendientePorPagar} color="#a16207" />
      </div>

      <div className="flex justify-end gap-2 flex-wrap">
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM });
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
                    vía {ocrProvider === "gemini" ? "Gemini" : "Groq"}{ocrVerif?.reintentado ? " (reintento)" : ""}
                  </span>
                )}
                {ocrVerif && !ocrVerif.coincide && (
                  <span className="text-xs" style={{ color: "#B45309" }}>
                    ⚠ factura: Bs {ocrVerif.totalFactura.toFixed(2)} · ítems: Bs {ocrVerif.sumaItems.toFixed(2)}
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
                <img src={form.comprobanteUrl} alt="Factura" className="rounded-md border max-h-40 object-contain" style={{ borderColor: "var(--erp-border)" }} />
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>N° Factura</label>
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}
                  value={form.numeroFactura}
                  onChange={(e) => setForm((p) => ({ ...p, numeroFactura: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>

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
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Descripción</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Servicio de Internet"
              />
            </div>
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

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--erp-text)" }}>
              <input
                type="checkbox"
                checked={form.recurrente}
                onChange={(e) => setForm((p) => ({ ...p, recurrente: e.target.checked }))}
              />
              Gasto recurrente (recordatorio automático)
            </label>
            {form.recurrente && (
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.frecuencia}
                onChange={(e) => setForm((p) => ({ ...p, frecuencia: e.target.value as FrecuenciaRecurrencia }))}
              >
                {FRECUENCIAS_RECURRENCIA.map((f) => (
                  <option key={f} value={f}>{FRECUENCIA_RECURRENCIA_LABELS[f]}</option>
                ))}
              </select>
            )}
          </div>

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
        {(filtroDesde || filtroHasta || filtroProveedor || filtroTipoGastoId) && (
          <button
            type="button"
            onClick={() => { setFiltroDesde(""); setFiltroHasta(""); setFiltroProveedor(""); setFiltroTipoGastoId(""); setPage(1); }}
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
    </div>
  );
}

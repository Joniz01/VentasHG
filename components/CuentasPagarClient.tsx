"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type EstadoCP = "PENDIENTE" | "PENDIENTE_PARCIAL" | "PAGADO" | "ANULADO";

type CuentaPagar = {
  id: number;
  proveedor: string;
  proveedorRif: string | null;
  numeroFactura: string | null;
  descripcion: string | null;
  fechaEmision: string;
  fechaVencimiento: string;
  montoBs: number;
  montoUsd: number;
  tasaDia: number;
  estado: EstadoCP;
  montoOriginalBs: number | null;
  montoPagadoBs: number;
  pagadoAt: string | null;
  comprobanteUrl: string | null;
  notas: string | null;
  recurrente: boolean;
  frecuencia: string | null;
  proximoVencimiento: string | null;
  tipo: string;
};

type OcrData = {
  proveedorNombre?: string;
  proveedorRif?: string;
  proveedorTelefono?: string;
  proveedorDireccion?: string;
  numeroFactura?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  totalFacturaBs?: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const USD = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BS  = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (iso: string) => { if (!iso) return "—"; const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };

const ESTADO_STYLE: Record<EstadoCP, { text: string; bg: string; label: string }> = {
  PENDIENTE:         { text: "#D97706", bg: "rgba(217,119,6,0.10)",  label: "Pendiente" },
  PENDIENTE_PARCIAL: { text: "#B45309", bg: "rgba(180,83,9,0.10)",   label: "Pend. Parcial" },
  PAGADO:            { text: "#059669", bg: "rgba(5,150,105,0.10)",  label: "Pagado" },
  ANULADO:           { text: "#6B7280", bg: "rgba(107,114,128,0.10)",label: "Anulado" },
};

function esPendiente(cp: CuentaPagar) {
  return cp.estado === "PENDIENTE" || cp.estado === "PENDIENTE_PARCIAL";
}

// ── Form types ─────────────────────────────────────────────────────────────

type FrecuenciaCP = "SEMANAL" | "QUINCENAL" | "MENSUAL";

type FormData = {
  proveedor: string;
  proveedorRif: string;
  numeroFactura: string;
  descripcion: string;
  fechaEmision: string;
  fechaVencimiento: string;
  montoBs: string;
  montoUsd: string;
  tasaDia: string;
  notas: string;
  recurrente: boolean;
  frecuencia: FrecuenciaCP;
};

const HOY = new Date().toISOString().slice(0, 10);

// ── Sub-components ─────────────────────────────────────────────────────────

function OcrBtn({ onResult }: { onResult: (d: OcrData) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleFile(file: File) {
    setCargando(true);
    setMsg("Analizando factura…");
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/cuentas-pagar/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenBase64: base64, mimeType: file.type }),
      });
      const json = await resp.json();
      if (json.ok && json.data) {
        onResult(json.data as OcrData);
        setMsg("✓ Datos extraídos");
      } else {
        setMsg(json.error ?? "Error OCR");
      }
    } catch {
      setMsg("Error al procesar imagen");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={cargando}
        style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", color: "var(--erp-text)", fontSize: 13, cursor: "pointer" }}
      >
        {cargando ? "⏳ Procesando…" : "📷 Leer factura (OCR)"}
      </button>
      {msg && <span style={{ fontSize: 12, color: msg.startsWith("✓") ? "#059669" : "#EF4444" }}>{msg}</span>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

function CampoForm({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: "1px solid var(--erp-border)",
  background: "var(--erp-bg)", color: "var(--erp-text)", fontSize: 14, width: "100%", boxSizing: "border-box",
};

// ── Tasa fetch ─────────────────────────────────────────────────────────────

async function buscarTasaPorFecha(fecha: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/tasa-bcv?fecha=${fecha}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j.tasa ? Number(j.tasa) : null;
  } catch {
    return null;
  }
}

// ── Formulario de nueva cuenta — usado desde Gastos > Recurrentes ────────────────────────────

function FormularioCP({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (data: FormData) => Promise<string | null>;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<FormData>({
    proveedor: "", proveedorRif: "", numeroFactura: "", descripcion: "",
    fechaEmision: HOY, fechaVencimiento: HOY, montoBs: "", montoUsd: "", tasaDia: "", notas: "",
    recurrente: false, frecuencia: "MENSUAL",
  });
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState("");
  const [tasaMsg, setTasaMsg] = useState("");
  // "bs" | "usd" — qué campo editó el usuario por última vez
  const lastEdit = useRef<"bs" | "usd">("bs");

  // Al cambiar fecha de emisión, busca tasa histórica
  async function handleFechaEmision(fecha: string) {
    setForm(p => ({ ...p, fechaEmision: fecha }));
    if (!fecha) return;
    setTasaMsg("Buscando tasa…");
    const tasa = await buscarTasaPorFecha(fecha);
    if (tasa) {
      setTasaMsg(`Tasa: ${tasa.toFixed(4)} Bs/$`);
      setForm(p => {
        const newForm = { ...p, tasaDia: String(tasa) };
        // Recalcula el lado que no editó el usuario
        if (lastEdit.current === "bs" && p.montoBs) {
          newForm.montoUsd = (Number(p.montoBs) / tasa).toFixed(4);
        } else if (lastEdit.current === "usd" && p.montoUsd) {
          newForm.montoBs = (Number(p.montoUsd) * tasa).toFixed(2);
        }
        return newForm;
      });
    } else {
      setTasaMsg("Sin tasa registrada para esta fecha");
    }
  }

  function handleTasa(val: string) {
    const tasa = Number(val);
    setForm(p => {
      const newForm = { ...p, tasaDia: val };
      if (tasa > 0) {
        if (lastEdit.current === "bs" && p.montoBs) {
          newForm.montoUsd = (Number(p.montoBs) / tasa).toFixed(4);
        } else if (lastEdit.current === "usd" && p.montoUsd) {
          newForm.montoBs = (Number(p.montoUsd) * tasa).toFixed(2);
        }
      }
      return newForm;
    });
  }

  function handleMontoBs(val: string) {
    lastEdit.current = "bs";
    const tasa = Number(form.tasaDia);
    setForm(p => ({
      ...p,
      montoBs: val,
      montoUsd: tasa > 0 && val ? (Number(val) / tasa).toFixed(4) : p.montoUsd,
    }));
  }

  function handleMontoUsd(val: string) {
    lastEdit.current = "usd";
    const tasa = Number(form.tasaDia);
    setForm(p => ({
      ...p,
      montoUsd: val,
      montoBs: tasa > 0 && val ? (Number(val) * tasa).toFixed(2) : p.montoBs,
    }));
  }

  function aplicarOcr(d: OcrData) {
    setForm(prev => {
      const newForm = {
        ...prev,
        proveedor:        d.proveedorNombre   ?? prev.proveedor,
        proveedorRif:     d.proveedorRif      ?? prev.proveedorRif,
        numeroFactura:    d.numeroFactura     ?? prev.numeroFactura,
        fechaEmision:     d.fechaEmision      ?? prev.fechaEmision,
        fechaVencimiento: d.fechaVencimiento  ?? prev.fechaVencimiento,
        montoBs:          d.totalFacturaBs    ? String(d.totalFacturaBs) : prev.montoBs,
      };
      // Recalcular USD si ya hay tasa
      const tasa = Number(newForm.tasaDia);
      if (tasa > 0 && newForm.montoBs) {
        newForm.montoUsd = (Number(newForm.montoBs) / tasa).toFixed(4);
        lastEdit.current = "bs";
      }
      return newForm;
    });
    // Buscar tasa para la fecha de la factura si el OCR la detectó
    if (d.fechaEmision) handleFechaEmision(d.fechaEmision);
  }

  async function handleSubmit() {
    setFormError("");
    if (!form.proveedor.trim() || !form.fechaEmision || !form.fechaVencimiento) {
      setFormError("Proveedor, fecha de emisión y vencimiento son obligatorios.");
      return;
    }
    setGuardando(true);
    const err = await onGuardar(form);
    setGuardando(false);
    if (err) setFormError(err);
  }

  return (
    <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--erp-text)" }}>Nueva Cuenta por Pagar</span>
        <OcrBtn onResult={aplicarOcr} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        <CampoForm label="Proveedor / Servicio *">
          <input style={inputStyle} value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} placeholder="Nombre del proveedor" />
        </CampoForm>
        <CampoForm label="RIF">
          <input style={inputStyle} value={form.proveedorRif} onChange={e => setForm(p => ({ ...p, proveedorRif: e.target.value }))} placeholder="J-00000000-0" />
        </CampoForm>
        <CampoForm label="Nº Factura">
          <input style={inputStyle} value={form.numeroFactura} onChange={e => setForm(p => ({ ...p, numeroFactura: e.target.value }))} placeholder="Número de factura" />
        </CampoForm>
        <CampoForm label="Descripción">
          <input style={inputStyle} value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción o concepto" />
        </CampoForm>

        {/* Fecha emisión — dispara búsqueda de tasa */}
        <CampoForm label={`Fecha Emisión *${tasaMsg ? `  ·  ${tasaMsg}` : ""}`}>
          <input type="date" style={inputStyle} value={form.fechaEmision}
            onChange={e => handleFechaEmision(e.target.value)} />
        </CampoForm>

        <CampoForm label="Fecha Vencimiento *">
          <input type="date" style={inputStyle} value={form.fechaVencimiento}
            onChange={e => setForm(p => ({ ...p, fechaVencimiento: e.target.value }))} />
        </CampoForm>

        {/* Tasa editable — actualiza la conversión */}
        <CampoForm label="Tasa del día (Bs/$)">
          <input type="number" min="0" step="0.0001" style={inputStyle} value={form.tasaDia}
            onChange={e => handleTasa(e.target.value)} placeholder="0.0000" />
        </CampoForm>

        {/* Monto Bs ↔ USD con conversión bidireccional */}
        <CampoForm label="Monto Bs">
          <input type="number" min="0" step="0.01" style={inputStyle} value={form.montoBs}
            onChange={e => handleMontoBs(e.target.value)} placeholder="0.00" />
        </CampoForm>
        <CampoForm label="Monto USD">
          <input type="number" min="0" step="0.0001" style={inputStyle} value={form.montoUsd}
            onChange={e => handleMontoUsd(e.target.value)} placeholder="0.0000" />
        </CampoForm>

        <CampoForm label="Notas">
          <input style={inputStyle} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones opcionales" />
        </CampoForm>
      </div>

      {/* Recurrencia */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--erp-text)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.recurrente}
            onChange={e => setForm(p => ({ ...p, recurrente: e.target.checked }))} />
          🔁 Gasto recurrente (genera siguiente período al pagar)
        </label>
        {form.recurrente && (
          <select style={{ ...inputStyle, width: "auto" }} value={form.frecuencia}
            onChange={e => setForm(p => ({ ...p, frecuencia: e.target.value as FrecuenciaCP }))}>
            <option value="SEMANAL">Semanal</option>
            <option value="QUINCENAL">Quincenal</option>
            <option value="MENSUAL">Mensual</option>
          </select>
        )}
      </div>

      {formError && <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>{formError}</p>}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={handleSubmit} disabled={guardando}
          style={{ padding: "8px 20px", borderRadius: 8, background: "#B45309", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={onCancelar}
          style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 14 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function CuentasPagarClient() {
  const [items, setItems] = useState<CuentaPagar[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(true);

  // ── Tab principal ──────────────────────────────────────────────────────────
  type TabCxP = "pendientes" | "pagados";
  const [tabCxP, setTabCxP] = useState<TabCxP>("pendientes");

  // ── Estado pagados ─────────────────────────────────────────────────────────
  type PagadosPeriodo = "esta_semana" | "sem_anterior" | "mes_actual" | "rango";
  const [pagadosPeriodo, setPagadosPeriodo] = useState<PagadosPeriodo>("mes_actual");
  const [pagadosDesde, setPagadosDesde] = useState("");
  const [pagadosHasta, setPagadosHasta] = useState("");
  const [itemsPagados, setItemsPagados] = useState<CuentaPagar[]>([]);
  const [loadingPagados, setLoadingPagados] = useState(false);

  // filtros
  const [filtroEstado, setFiltroEstado] = useState<"PENDIENTE" | "PENDIENTE_PARCIAL">("PENDIENTE");
  const [filtroProveedor, setFiltroProveedor] = useState("");

  // filtro por fecha de vencimiento
  type FiltroFecha = "" | "esta_semana" | "prox_semana" | "rango";
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>("esta_semana");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  function getRangoFecha(filtro: FiltroFecha): { desde: string; hasta: string } | null {
    const hoy = new Date();
    const dow = hoy.getDay(); // 0=dom
    const lunesOffset = dow === 0 ? -6 : 1 - dow;
    if (filtro === "esta_semana") {
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + lunesOffset);
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { desde: lunes.toISOString().slice(0, 10), hasta: domingo.toISOString().slice(0, 10) };
    }
    if (filtro === "prox_semana") {
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + lunesOffset + 7);
      const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      return { desde: lunes.toISOString().slice(0, 10), hasta: domingo.toISOString().slice(0, 10) };
    }
    if (filtro === "rango") {
      return { desde: filtroDesde, hasta: filtroHasta };
    }
    return null;
  }

  // filtro por sección
  type SecKey = "servicios" | "ocasionales" | "compras";
  const [secFiltros, setSecFiltros] = useState<Set<SecKey>>(new Set(["servicios", "ocasionales", "compras"]));
  function toggleSec(s: SecKey) {
    setSecFiltros(prev => {
      const next = new Set(prev);
      if (next.has(s)) { if (next.size > 1) next.delete(s); }
      else next.add(s);
      return next;
    });
  }

  // modal pago
  type PagoModal = { id: number; montoBs: number; montoUsd: number; tasaDia: number; proveedor: string };
  const [pagoModal, setPagoModal] = useState<PagoModal | null>(null);
  const [tipoPago, setTipoPago] = useState<"total" | "parcial">("total");
  const [montoParcialBs, setMontoParcialBs] = useState("");
  const [montoParcialUsd, setMontoParcialUsd] = useState("");
  const [nuevaFechVenc, setNuevaFechVenc] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [pagando, setPagando] = useState(false);
  const [fechaPago, setFechaPago] = useState("");
  const [tasaPago, setTasaPago] = useState<number | null>(null);
  const [tasaPagoEditable, setTasaPagoEditable] = useState(false);
  const [tasaPagoInput, setTasaPagoInput] = useState("");
  const [buscandoTasa, setBuscandoTasa] = useState(false);

  // Auto-init: cuando se abre el modal, carga la fecha y tasa de hoy
  useEffect(() => {
    if (pagoModal) {
      const hoy = new Date().toISOString().slice(0, 10);
      setTipoPago("total");
      setMontoParcialBs(""); setMontoParcialUsd(""); setNuevaFechVenc(""); setNotaPago("");
      handleFechaPagoModal(hoy);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoModal]);

  // Pre-llenar montos en modo Parcial cuando la tasa esté disponible
  useEffect(() => {
    if (tipoPago === "parcial" && tasaPago != null && pagoModal && !montoParcialBs && !montoParcialUsd) {
      setMontoParcialUsd(pagoModal.montoUsd.toFixed(2));
      setMontoParcialBs((pagoModal.montoUsd * tasaPago).toFixed(2));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPago, tasaPago]);

  // eliminación inline
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // revertir último abono
  const [revirtiendoId, setRevirtiendoId] = useState<number | null>(null);
  const [revirtiendo, setRevirtiendo] = useState(false);

  // edición
  const [editModal, setEditModal] = useState<CuentaPagar | null>(null);
  const [editForm, setEditForm] = useState<Partial<FormData>>({});
  const [editGuardando, setEditGuardando] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function abrirEditar(cp: CuentaPagar) {
    setEditModal(cp);
    setEditForm({
      proveedor: cp.proveedor,
      proveedorRif: cp.proveedorRif ?? "",
      numeroFactura: cp.numeroFactura ?? "",
      descripcion: cp.descripcion ?? "",
      fechaEmision: cp.fechaEmision,
      fechaVencimiento: cp.fechaVencimiento,
      montoBs: String(cp.montoBs),
      montoUsd: String(cp.montoUsd),
      notas: cp.notas ?? "",
    });
    setEditError(null);
  }

  async function handleEditGuardar() {
    if (!editModal) return;
    setEditGuardando(true);
    setEditError(null);
    try {
      const r = await fetch(`/api/cuentas-pagar/${editModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor: editForm.proveedor,
          proveedorRif: editForm.proveedorRif || undefined,
          numeroFactura: editForm.numeroFactura || undefined,
          descripcion: editForm.descripcion || undefined,
          fechaEmision: editForm.fechaEmision,
          fechaVencimiento: editForm.fechaVencimiento,
          montoBs: Number(editForm.montoBs) || 0,
          montoUsd: Number(editForm.montoUsd) || 0,
          notas: editForm.notas || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setEditError(j.error ?? "Error al guardar"); return; }
      setEditModal(null);
      cargar();
    } catch {
      setEditError("Error de conexión");
    } finally {
      setEditGuardando(false);
    }
  }

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("pageSize", String(PAGE_SIZE));
      if (filtroEstado) p.set("estado", filtroEstado);
      if (filtroProveedor.trim()) p.set("proveedor", filtroProveedor.trim());
      const rango = getRangoFecha(filtroFecha);
      if (rango?.desde) p.set("desde", rango.desde);
      if (rango?.hasta) p.set("hasta", rango.hasta);
      const r = await fetch(`/api/cuentas-pagar?${p}`);
      const j = await r.json();
      setItems((j.items ?? []) as CuentaPagar[]);
      setTotal(j.total ?? 0);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filtroEstado, filtroProveedor, filtroFecha, filtroDesde, filtroHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarPagados = useCallback(async () => {
    const hoy = new Date();
    const dow = hoy.getDay();
    const lunesOffset = dow === 0 ? -6 : 1 - dow;
    let desde = "", hasta = "";
    if (pagadosPeriodo === "esta_semana") {
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + lunesOffset);
      const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6);
      desde = lunes.toISOString().slice(0, 10); hasta = dom.toISOString().slice(0, 10);
    } else if (pagadosPeriodo === "sem_anterior") {
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() + lunesOffset - 7);
      const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6);
      desde = lunes.toISOString().slice(0, 10); hasta = dom.toISOString().slice(0, 10);
    } else if (pagadosPeriodo === "mes_actual") {
      desde = hoy.toISOString().slice(0, 8) + "01";
      hasta = hoy.toISOString().slice(0, 10);
    } else {
      desde = pagadosDesde; hasta = pagadosHasta;
    }
    if (!desde || !hasta) return;
    setLoadingPagados(true);
    try {
      const p = new URLSearchParams({ estado: "PAGADO", pagadoDesde: desde, pagadoHasta: hasta, pageSize: "100" });
      const r = await fetch(`/api/cuentas-pagar?${p}`);
      if (r.ok) { const j = await r.json(); setItemsPagados(j.items ?? []); }
    } finally { setLoadingPagados(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagadosPeriodo, pagadosDesde, pagadosHasta]);

  useEffect(() => { if (tabCxP === "pagados") cargarPagados(); }, [tabCxP, cargarPagados]);

  // Fecha de pago → busca tasa histórica; si no hay, consulta la tasa BCV vigente (live)
  async function handleFechaPagoModal(fecha: string) {
    setFechaPago(fecha);
    if (!fecha) { setTasaPago(null); setTasaPagoEditable(false); setTasaPagoInput(""); return; }
    setBuscandoTasa(true);
    const tasaHistorial = await buscarTasaPorFecha(fecha);
    let tasaFinal = tasaHistorial;
    if (!tasaFinal) {
      // Sin historial para esa fecha: consultar tasa BCV vigente (live)
      try {
        const r = await fetch("/api/tasa-bcv");
        if (r.ok) {
          const j = await r.json();
          if (j.tasa) tasaFinal = Number(j.tasa);
        }
      } catch { /* sin conexión */ }
    }
    setBuscandoTasa(false);
    if (tasaFinal && tasaFinal > 0) {
      setTasaPago(tasaFinal);
      setTasaPagoInput(String(tasaFinal));
      setTasaPagoEditable(true);
    } else {
      setTasaPago(null);
      setTasaPagoInput("");
      setTasaPagoEditable(true);
    }
  }

  function handleTasaPagoInput(val: string) {
    setTasaPagoInput(val);
    const t = Number(val);
    setTasaPago(t > 0 ? t : null);
    if (t > 0) {
      if (montoParcialBs) setMontoParcialUsd((Number(montoParcialBs) / t).toFixed(2));
    }
  }

  // Conversión bidireccional en modal de pago parcial
  // montoParcialBs guarda el número raw (sin comas); la vista lo formatea
  function handleParcialBs(val: string) {
    const raw = val.replace(/,/g, "");  // strip separadores al escribir
    setMontoParcialBs(raw);
    const t = tasaPago ?? pagoModal?.tasaDia;
    if (t && t > 0 && raw) setMontoParcialUsd((Number(raw) / t).toFixed(2));
  }
  function handleParcialUsd(val: string) {
    setMontoParcialUsd(val);
    const t = tasaPago ?? pagoModal?.tasaDia;
    if (t && t > 0 && val) setMontoParcialBs((Number(val) * t).toFixed(2));
  }

  async function handlePagar() {
    if (!pagoModal) return;
    setPagando(true);
    try {
      const body =
        tipoPago === "total"
          ? {
              accion: "pagar",
              fechaPago: fechaPago || undefined,
              tasaDia: (tasaPago ?? pagoModal.tasaDia) || undefined,
            }
          : {
              accion: "pago_parcial",
              montoPagadoBs: Number(montoParcialBs) || 0,
              montoPagadoUsd: Number(montoParcialUsd) || 0,
              tasaDia: tasaPago ?? pagoModal.tasaDia,
              fechaPago: fechaPago || undefined,
              nuevaFechVenc: nuevaFechVenc || undefined,
              nota: notaPago || undefined,
            };
      const r = await fetch(`/api/cuentas-pagar/${pagoModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setPagoModal(null);
        setMontoParcialBs(""); setMontoParcialUsd(""); setNuevaFechVenc(""); setNotaPago("");
        setFechaPago(""); setTasaPago(null); setTasaPagoInput(""); setTasaPagoEditable(false);
        cargar();
      } else {
        const j = await r.json();
        alert((j.error ?? "Error al registrar pago") + (j.detalle ? `\n\n${j.detalle}` : ""));
      }
    } finally {
      setPagando(false);
    }
  }

  async function handleEliminar(id: number) {
    setEliminando(true);
    try {
      const r = await fetch(`/api/cuentas-pagar/${id}`, { method: "DELETE" });
      if (r.ok) { setEliminandoId(null); cargar(); }
      else { const j = await r.json(); alert(j.error ?? "Error al eliminar"); }
    } finally {
      setEliminando(false);
    }
  }

  async function handleRevertir(id: number) {
    setRevirtiendo(true);
    try {
      const r = await fetch(`/api/cuentas-pagar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "revertir_ultimo_abono" }),
      });
      if (r.ok) { setRevirtiendoId(null); cargar(); }
      else { const j = await r.json(); alert((j.error ?? "Error al revertir") + (j.detalle ? `\n\n${j.detalle}` : "")); }
    } finally {
      setRevirtiendo(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--erp-text)", margin: 0 }}>Cuentas por Pagar</h2>
          <p style={{ fontSize: 13, color: "var(--erp-text-2)", margin: "2px 0 0" }}>Panel consolidado — Servicios · Compras a crédito · Gastos ocasionales</p>
        </div>
        {(() => {
          const pendientes = items.filter(cp => cp.estado === "PENDIENTE" || cp.estado === "PENDIENTE_PARCIAL");
          const totalBs  = pendientes.reduce((s, cp) => s + cp.montoBs, 0);
          const totalUsd = pendientes.reduce((s, cp) => s + cp.montoUsd, 0);
          if (pendientes.length === 0) return null;
          return (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: "8px 16px", textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--erp-text-3)", marginBottom: 2 }}>Total pendiente Bs</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#B45309", fontVariantNumeric: "tabular-nums" }}>{BS(totalBs)}</div>
              </div>
              <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: "8px 16px", textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--erp-text-3)", marginBottom: 2 }}>Total pendiente USD</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums" }}>${USD(totalUsd)}</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--erp-border)" }}>
        {([["pendientes", "📋 Por Pagar"], ["pagados", "✅ Pagados"]] as [TabCxP, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTabCxP(key)}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: tabCxP === key ? 700 : 500,
              cursor: "pointer", border: "none", background: "transparent",
              color: tabCxP === key ? "#059669" : "var(--erp-text-2)",
              borderBottom: tabCxP === key ? "2px solid #059669" : "2px solid transparent",
              marginBottom: -2, transition: "all 0.15s",
            }}
          >{label}</button>
        ))}
      </div>

      {/* Panel de pagados */}
      {tabCxP === "pagados" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Filtro período */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Período de pago:</span>
            {([
              ["esta_semana", "Esta semana"],
              ["sem_anterior", "Sem. anterior"],
              ["mes_actual", "Mes actual"],
              ["rango", "Rango"],
            ] as [PagadosPeriodo, string][]).map(([key, label]) => {
              const active = pagadosPeriodo === key;
              return (
                <button key={key} onClick={() => setPagadosPeriodo(key)}
                  style={{
                    padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: active ? 700 : 500,
                    cursor: "pointer", border: `1.5px solid ${active ? "#059669" : "var(--erp-border)"}`,
                    background: active ? "#059669" : "transparent",
                    color: active ? "#fff" : "var(--erp-text-2)", transition: "all 0.15s",
                  }}
                >{label}</button>
              );
            })}
            {pagadosPeriodo === "rango" && (
              <>
                <input type="date" value={pagadosDesde} onChange={e => setPagadosDesde(e.target.value)}
                  style={{ ...inputStyle, width: 136 }} />
                <span style={{ fontSize: 12, color: "var(--erp-text-3)" }}>—</span>
                <input type="date" value={pagadosHasta} onChange={e => setPagadosHasta(e.target.value)}
                  style={{ ...inputStyle, width: 136 }} />
                <button onClick={cargarPagados}
                  style={{ padding: "4px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1.5px solid #059669", background: "#059669", color: "#fff" }}>
                  Buscar
                </button>
              </>
            )}
          </div>
          {/* Tabla pagados */}
          <div style={{ overflowX: "auto" }}>
            {loadingPagados ? (
              <p style={{ color: "var(--erp-text-3)", textAlign: "center", padding: "2rem 0" }}>Cargando…</p>
            ) : itemsPagados.length === 0 ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--erp-text-3)", border: "1px dashed var(--erp-border)", borderRadius: 12, fontSize: 14 }}>
                No hay pagos registrados en este período.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--erp-border)" }}>
                    {[
                      { label: "Proveedor / Servicio", align: "left" },
                      { label: "Emisión",              align: "left" },
                      { label: "Fecha Pago",           align: "left" },
                      { label: "Monto Bs",             align: "right" },
                      { label: "Monto USD",            align: "right" },
                      { label: "Acciones",             align: "right" },
                    ].map(h => (
                      <th key={h.label} style={{ padding: "8px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--erp-text-3)", textAlign: h.align as React.CSSProperties["textAlign"], whiteSpace: "nowrap" }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsPagados.map((cp, idx) => {
                    const zebraBase = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
                    return (
                      <tr key={cp.id} style={{ borderBottom: "1px solid var(--erp-border)", background: zebraBase, borderLeft: "3px solid #059669" }}>
                        <td style={{ padding: "7px 14px" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--erp-text)" }}>
                            {cp.proveedor}
                            {cp.numeroFactura && <span style={{ fontSize: 11, color: "var(--erp-text-3)", fontWeight: 400, marginLeft: 6 }}>· {cp.numeroFactura}</span>}
                          </div>
                          {cp.descripcion && <div style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{cp.descripcion}</div>}
                        </td>
                        <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{fmtFecha(cp.fechaEmision)}</td>
                        <td style={{ padding: "7px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>✓ {cp.pagadoAt ? fmtFecha(cp.pagadoAt.slice(0, 10)) : "—"}</span>
                        </td>
                        <td style={{ padding: "7px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 600, color: "var(--erp-text)", whiteSpace: "nowrap" }}>
                          {(() => { const m = cp.montoOriginalBs ?? cp.montoBs; return m > 0 ? BS(m) : "—"; })()}
                        </td>
                        <td style={{ padding: "7px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700, color: "var(--erp-text)", whiteSpace: "nowrap" }}>
                          {(() => { const m = cp.montoOriginalBs ?? cp.montoBs; return m > 0 && cp.tasaDia > 0 ? `$${USD(m / cp.tasaDia)}` : "—"; })()}
                        </td>
                        <td style={{ padding: "7px 14px", textAlign: "right" }}>
                          {revirtiendoId === cp.id ? (
                            <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                              <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>¿Revertir?</span>
                              <button onClick={() => handleRevertir(cp.id)} disabled={revirtiendo}
                                style={{ padding: "3px 8px", borderRadius: 6, background: "#D97706", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                {revirtiendo ? "…" : "Sí"}
                              </button>
                              <button onClick={() => setRevirtiendoId(null)}
                                style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 11 }}>No</button>
                            </div>
                          ) : (
                            <button onClick={() => setRevirtiendoId(cp.id)} title="Revertir pago"
                              style={{ padding: "5px 10px", borderRadius: 8, background: "transparent", color: "#D97706", border: "1px solid #D97706", fontSize: 13, cursor: "pointer" }}>
                              ↩ Revertir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "1.5px solid var(--erp-border)", background: "var(--erp-bg)" }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 11, color: "var(--erp-text-3)" }}>{itemsPagados.length} pago{itemsPagados.length !== 1 ? "s" : ""}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                      {BS(itemsPagados.reduce((s, cp) => s + (cp.montoOriginalBs ?? cp.montoBs), 0))}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 13, fontWeight: 800, color: "#059669", fontVariantNumeric: "tabular-nums" }}>
                      ${USD(itemsPagados.reduce((s, cp) => { const m = cp.montoOriginalBs ?? cp.montoBs; return s + (m > 0 && cp.tasaDia > 0 ? m / cp.tasaDia : 0); }, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Panel de filtros + tabla operativa (solo tab pendientes) */}
      {tabCxP === "pendientes" && <>
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 10, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Fila 1: Sección + buscador */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Sección:</span>
          {(["servicios", "ocasionales", "compras"] as SecKey[]).map(key => {
            const labels: Record<SecKey, string> = { servicios: "🔧 Servicios", ocasionales: "📋 Ocasionales", compras: "🛒 Compras" };
            const active = secFiltros.has(key);
            return (
              <button key={key} type="button" onClick={() => toggleSec(key)}
                style={{
                  padding: "4px 11px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", border: `1.5px solid ${active ? "#059669" : "var(--erp-border)"}`,
                  background: active ? "#059669" : "transparent",
                  color: active ? "#fff" : "var(--erp-text-2)",
                  transition: "all 0.12s",
                }}>
                {labels[key]}
              </button>
            );
          })}
          <input
            placeholder="Buscar proveedor…"
            value={filtroProveedor}
            onChange={e => { setFiltroProveedor(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: 180, flex: "0 0 auto", marginLeft: "auto" }}
          />
        </div>
        {/* Fila 2: Estado + separador + Vencimiento */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Estado:</span>
          {(["PENDIENTE", "PENDIENTE_PARCIAL"] as const).map(e => {
            const active = filtroEstado === e;
            const countParcial = e === "PENDIENTE_PARCIAL" ? items.filter(cp => cp.estado === "PENDIENTE_PARCIAL").length : 0;
            return (
              <button key={e} onClick={() => { setFiltroEstado(e); setPage(1); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 11px", borderRadius: 99, fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
                  border: `1px solid ${active ? "#B45309" : "var(--erp-border)"}`,
                  background: active ? "rgba(180,83,9,0.10)" : "transparent",
                  color: active ? "#B45309" : "var(--erp-text-2)" }}>
                {e === "PENDIENTE" ? "Por Pagar" : "Pend. Parcial"}
                {e === "PENDIENTE_PARCIAL" && countParcial > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(180,83,9,0.15)", color: "#B45309", borderRadius: 99, padding: "1px 6px", lineHeight: 1.4 }}>
                    {countParcial}
                  </span>
                )}
              </button>
            );
          })}
          <div style={{ width: 1, height: 16, background: "var(--erp-border)", margin: "0 4px", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Vencimiento:</span>
          {([
            { key: "" as FiltroFecha, label: "Todos" },
            { key: "esta_semana" as FiltroFecha, label: "Esta semana" },
            { key: "prox_semana" as FiltroFecha, label: "Próx. semana" },
            { key: "rango" as FiltroFecha, label: "Rango" },
          ]).map(({ key, label }) => {
            const active = filtroFecha === key;
            return (
              <button key={key || "todos"} onClick={() => { setFiltroFecha(key); setPage(1); }}
                style={{ padding: "4px 11px", borderRadius: 99, fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer",
                  border: `1px solid ${active ? "#0F5FA6" : "var(--erp-border)"}`,
                  background: active ? "rgba(15,95,166,0.10)" : "transparent",
                  color: active ? "#0F5FA6" : "var(--erp-text-2)" }}>
                {label}
              </button>
            );
          })}
          {filtroFecha === "rango" && (
            <>
              <input type="date" value={filtroDesde} onChange={e => { setFiltroDesde(e.target.value); setPage(1); }}
                style={{ ...inputStyle, width: 136, flex: "0 0 auto" }} />
              <span style={{ fontSize: 12, color: "var(--erp-text-3)" }}>—</span>
              <input type="date" value={filtroHasta} onChange={e => { setFiltroHasta(e.target.value); setPage(1); }}
                style={{ ...inputStyle, width: 136, flex: "0 0 auto" }} />
            </>
          )}
        </div>
      </div>

      {/* Grid estilo inventario */}
      {loading ? (
        <p style={{ color: "var(--erp-text-3)", textAlign: "center", padding: "2rem 0" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--erp-text-3)", border: "1px dashed var(--erp-border)", borderRadius: 12, fontSize: 14 }}>
          Sin cuentas por pagar registradas.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid var(--erp-border)" }}>
                {[
                  { label: "Proveedor / Servicio", align: "left"  },
                  { label: "Vencimiento",           align: "left"  },
                  { label: "Monto Bs",              align: "right" },
                  { label: "Monto USD",             align: "right" },
                  { label: "Estado",                align: "center"},
                  { label: "Acciones",              align: "right" },
                ].map(h => (
                  <th key={h.label} style={{
                    padding: "8px 14px", fontSize: 11, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    color: "var(--erp-text-3)", textAlign: h.align as React.CSSProperties["textAlign"],
                    whiteSpace: "nowrap",
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                let rowNum = 0;
                return [...items]
                .filter(cp => {
                  if (cp.recurrente) return secFiltros.has("servicios");
                  if (cp.tipo === "compra") return secFiltros.has("compras");
                  return secFiltros.has("ocasionales");
                })
                .sort((a, b) => {
                  const orden = (cp: CuentaPagar) => cp.recurrente ? 0 : cp.tipo === "compra" ? 2 : 1;
                  return orden(a) - orden(b);
                })
                .map((cp, idx, sorted) => {
                const prev = idx > 0 ? sorted[idx - 1] : null;
                const secActual = cp.recurrente ? "servicios" : cp.tipo === "compra" ? "compras" : "ocasionales";
                const secPrev   = prev ? (prev.recurrente ? "servicios" : prev.tipo === "compra" ? "compras" : "ocasionales") : null;
                const showSeccionServicios  = secActual === "servicios"  && secPrev !== "servicios";
                const showSeccionGastos     = secActual === "ocasionales" && secPrev !== "ocasionales";
                const showSeccionCompras    = secActual === "compras"    && secPrev !== "compras";
                const NCOLS = 6;
                const secStyle: React.CSSProperties = {
                  padding: "5px 14px", fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
                  textTransform: "uppercase", color: "var(--erp-text-3)",
                  background: "var(--erp-bg)", borderBottom: "1px solid var(--erp-border)",
                  borderTop: idx > 0 ? "1px solid var(--erp-border)" : undefined,
                };
                const est = ESTADO_STYLE[cp.estado] ?? ESTADO_STYLE.PENDIENTE;
                const esElim = eliminandoId === cp.id;
                const vencidoYPendiente = esPendiente(cp) && cp.fechaVencimiento < HOY;
                const zebraBase = (rowNum++ % 2 === 0) ? "#ffffff" : "#f9fafb";
                return (
                  <React.Fragment key={cp.id}>
                  {showSeccionServicios && (
                    <tr><td colSpan={NCOLS} style={secStyle}>🔧 Servicios Recurrentes</td></tr>
                  )}
                  {showSeccionGastos && (
                    <tr><td colSpan={NCOLS} style={secStyle}>📋 Gastos Ocasionales</td></tr>
                  )}
                  {showSeccionCompras && (
                    <tr><td colSpan={NCOLS} style={secStyle}>🛒 Compras a Crédito</td></tr>
                  )}
                  <tr style={{
                    borderBottom: "1px solid var(--erp-border)",
                    background: esElim ? "rgba(239,68,68,0.05)" : zebraBase,
                  }}>
                    {/* Proveedor */}
                    <td style={{ padding: "7px 14px" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--erp-text)" }}>
                        {cp.proveedor}
                        {cp.recurrente && (
                          <span style={{ fontSize: 9, background: "rgba(37,99,235,0.10)", color: "#2563EB", borderRadius: 4, padding: "1px 5px", fontWeight: 800, letterSpacing: "0.04em", marginLeft: 6, verticalAlign: "middle" }}>
                            {cp.frecuencia}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Vencimiento */}
                    <td style={{ padding: "7px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: vencidoYPendiente ? "#EF4444" : "var(--erp-text)" }}>
                        {fmtFecha(cp.fechaVencimiento)}
                      </div>
                      {vencidoYPendiente && (
                        <div style={{ fontSize: 10, color: "#EF4444", fontWeight: 700 }}>Vencido</div>
                      )}
                    </td>

                    {/* Monto Bs */}
                    <td style={{ padding: "7px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>{BS(cp.montoBs)}</div>
                      {cp.montoOriginalBs && cp.montoOriginalBs !== cp.montoBs && (
                        <div style={{ fontSize: 10, color: "var(--erp-text-3)" }}>orig. {BS(cp.montoOriginalBs)}</div>
                      )}
                    </td>

                    {/* Monto USD */}
                    <td style={{ padding: "7px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-text)" }}>${USD(cp.montoUsd)}</div>
                      {cp.estado === "PENDIENTE_PARCIAL" && cp.montoOriginalBs && cp.tasaDia > 0 && (
                        <div style={{ fontSize: 10, color: "#059669", fontWeight: 700 }}>
                          +${USD((cp.montoOriginalBs / cp.tasaDia) - cp.montoUsd)} pagado
                        </div>
                      )}
                      {cp.tasaDia > 0 && (
                        <div style={{ fontSize: 10, color: "var(--erp-text-3)" }}>
                          tasa {cp.tasaDia.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td style={{ padding: "7px 14px", textAlign: "center" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 99, background: est.bg, color: est.text, fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>
                        {est.label}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: "7px 14px" }}>
                      {esElim ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 12, color: "#EF4444" }}>¿Eliminar?</span>
                          <button onClick={() => handleEliminar(cp.id)} disabled={eliminando}
                            style={{ padding: "3px 10px", borderRadius: 6, background: "#EF4444", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                            {eliminando ? "…" : "Sí"}
                          </button>
                          <button onClick={() => setEliminandoId(null)}
                            style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 12 }}>No</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {esPendiente(cp) && (
                            <button
                              onClick={() => {
                                setPagoModal({ id: cp.id, montoBs: cp.montoBs, montoUsd: cp.montoUsd, tasaDia: cp.tasaDia, proveedor: cp.proveedor });
                                setTipoPago("total"); setMontoParcialBs(""); setMontoParcialUsd(""); setNuevaFechVenc(""); setNotaPago("");
                                setFechaPago(""); setTasaPago(null); setTasaPagoInput(""); setTasaPagoEditable(false);
                              }}
                              style={{ padding: "5px 12px", borderRadius: 8, background: "#059669", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}>
                              ✓ Pagar
                            </button>
                          )}
                          {cp.tipo === "compra" ? (
                            <a href="/compras" style={{ padding: "5px 10px", borderRadius: 8, background: "transparent", color: "var(--erp-text-3)", border: "1px solid var(--erp-border)", fontSize: 11, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}>
                              → Compras
                            </a>
                          ) : cp.recurrente ? (
                            <a href="/gastos" style={{ padding: "5px 10px", borderRadius: 8, background: "transparent", color: "var(--erp-text-3)", border: "1px solid var(--erp-border)", fontSize: 11, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}>
                              → Gastos
                            </a>
                          ) : (
                            <button onClick={() => abrirEditar(cp)}
                              style={{ padding: "5px 10px", borderRadius: 8, background: "transparent", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", fontSize: 13, cursor: "pointer" }}>
                              ✏️
                            </button>
                          )}
                          {(cp.estado === "PENDIENTE_PARCIAL" || cp.estado === "PAGADO") && (
                            revirtiendoId === cp.id ? (
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>¿Revertir?</span>
                                <button onClick={() => handleRevertir(cp.id)} disabled={revirtiendo}
                                  style={{ padding: "3px 8px", borderRadius: 6, background: "#D97706", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                                  {revirtiendo ? "…" : "Sí"}
                                </button>
                                <button onClick={() => setRevirtiendoId(null)}
                                  style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 11 }}>No</button>
                              </div>
                            ) : (
                              <button onClick={() => setRevirtiendoId(cp.id)} title="Revertir último abono"
                                style={{ padding: "5px 10px", borderRadius: 8, background: "transparent", color: "#D97706", border: "1px solid #D97706", fontSize: 13, cursor: "pointer" }}>
                                ↩
                              </button>
                            )
                          )}
                          {cp.estado !== "PENDIENTE_PARCIAL" && (
                            <button onClick={() => setEliminandoId(cp.id)}
                              style={{ padding: "5px 10px", borderRadius: 8, background: "transparent", color: "var(--erp-text-3)", border: "1px solid var(--erp-border)", fontSize: 13, cursor: "pointer" }}>
                              🗑
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  </React.Fragment>
                );
              });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", cursor: "pointer", color: "var(--erp-text)" }}>← Ant.</button>
          <span style={{ fontSize: 13, color: "var(--erp-text-2)" }}>Pág. {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", cursor: "pointer", color: "var(--erp-text)" }}>Sig. →</button>
        </div>
      )}
      </> /* fin pendientes */}

      {/* Modal Pago */}
      {pagoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--erp-surface)", borderRadius: 16, padding: 28, width: 440, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "var(--erp-text)" }}>Registrar Pago</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--erp-text-2)" }}>
              {pagoModal.proveedor}
              {pagoModal.montoUsd > 0 && <strong> · ${USD(pagoModal.montoUsd)} USD</strong>}
              {tasaPago != null && tasaPago > 0 && (
                <span style={{ color: "var(--erp-text-3)" }}> · Tasa {tasaPago.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Bs/$</span>
              )}
            </p>

            {/* Toggle tipo pago */}
            <div style={{ display: "flex", marginBottom: 20, border: "1px solid var(--erp-border)", borderRadius: 8, overflow: "hidden" }}>
              {(["total", "parcial"] as const).map(t => (
                <button key={t} onClick={() => setTipoPago(t)}
                  style={{ flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontWeight: tipoPago === t ? 700 : 400, fontSize: 14, background: tipoPago === t ? "#059669" : "var(--erp-surface)", color: tipoPago === t ? "#fff" : "var(--erp-text-2)" }}>
                  {t === "total" ? "Pago Total" : "Pago Parcial"}
                </button>
              ))}
            </div>

            {/* Fecha + Tasa — compartido entre ambos modos */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <CampoForm label="📅 Fecha de pago">
                <input type="date" style={inputStyle} value={fechaPago} onChange={e => handleFechaPagoModal(e.target.value)} />
              </CampoForm>
              <CampoForm label={tasaPagoEditable ? "Tasa Bs/$ (editar)" : "Tasa Bs/$"}>
                <input
                  type="number" min="0" step="0.01"
                  style={{ ...inputStyle, background: tasaPagoEditable ? undefined : "var(--erp-bg)", color: tasaPagoEditable ? undefined : "var(--erp-text-3)" }}
                  value={buscandoTasa ? "" : tasaPagoInput}
                  placeholder={buscandoTasa ? "Buscando…" : tasaPagoEditable ? "Ingresa la tasa" : "—"}
                  readOnly={!tasaPagoEditable}
                  onChange={e => tasaPagoEditable && handleTasaPagoInput(e.target.value)}
                />
              </CampoForm>
            </div>
            {fechaPago && !buscandoTasa && tasaPago == null && (
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#D97706" }}>⚠ Sin tasa disponible — ingresa la tasa manualmente.</p>
            )}

            {tipoPago === "total" && tasaPago != null && (
              <div style={{ background: "rgba(5,150,105,0.08)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#059669", fontWeight: 600 }}>
                Pago total: <strong>${USD(pagoModal.montoUsd)}</strong> USD · {BS(pagoModal.montoBs)} Bs
              </div>
            )}

            {tipoPago === "parcial" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {/* Referencia: total actual en USD a tasa de hoy */}
                {tasaPago != null && (
                  <div style={{ background: "rgba(107,114,128,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--erp-text-2)" }}>
                    Total pendiente: <strong>${USD(pagoModal.montoUsd)}</strong> USD · {BS(pagoModal.montoBs)} Bs
                  </div>
                )}
                {/* Conversión bidireccional en modal */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <CampoForm label="Abonar (Bs)">
                    <input
                      type="text" inputMode="decimal" style={inputStyle}
                      value={montoParcialBs !== "" ? Number(montoParcialBs).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      onChange={e => handleParcialBs(e.target.value)}
                      placeholder={`Máx. ${BS(pagoModal.montoBs)}`}
                    />
                  </CampoForm>
                  <CampoForm label="Equiv. USD ($)">
                    <input type="text" inputMode="decimal" style={inputStyle} value={montoParcialUsd}
                      onChange={e => handleParcialUsd(e.target.value)} placeholder="0.00" />
                  </CampoForm>
                </div>
                {montoParcialUsd && pagoModal.montoUsd > 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--erp-text-3)" }}>
                    Restante: <strong>${USD(Math.max(0, pagoModal.montoUsd - (Number(montoParcialUsd) || 0)))}</strong> USD
                  </p>
                )}
                <CampoForm label="Nueva fecha de vencimiento">
                  <input type="date" style={inputStyle} value={nuevaFechVenc} onChange={e => setNuevaFechVenc(e.target.value)} />
                </CampoForm>
                <CampoForm label="Nota (opcional)">
                  <input style={inputStyle} value={notaPago} onChange={e => setNotaPago(e.target.value)} placeholder="Referencia, cheque, etc." />
                </CampoForm>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handlePagar} disabled={pagando}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#059669", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}>
                {pagando ? "Registrando…" : "Confirmar Pago"}
              </button>
              <button onClick={() => setPagoModal(null)}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--erp-surface)", borderRadius: 16, padding: 28, width: 480, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "var(--erp-text)" }}>Editar Cuenta por Pagar</h3>
            {editError && <p style={{ margin: "0 0 12px", color: "#EF4444", fontSize: 13 }}>{editError}</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {([
                { label: "Proveedor / Servicio *", key: "proveedor", type: "text" },
                { label: "RIF", key: "proveedorRif", type: "text" },
                { label: "Nº Factura", key: "numeroFactura", type: "text" },
                { label: "Descripción", key: "descripcion", type: "text" },
                { label: "Fecha Emisión", key: "fechaEmision", type: "date" },
                { label: "Fecha Vencimiento", key: "fechaVencimiento", type: "date" },
                { label: "Monto Bs", key: "montoBs", type: "number" },
                { label: "Monto USD", key: "montoUsd", type: "number" },
                { label: "Notas", key: "notas", type: "text" },
              ] as { label: string; key: keyof typeof editForm; type: string }[]).map(({ label, key, type }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-text-2)" }}>{label}</label>
                  <input
                    type={type}
                    value={String(editForm[key] ?? "")}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            {editModal.recurrente && (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--erp-text-3)" }}>
                📅 Recurrente ({editModal.frecuencia}) — al guardar solo se actualiza este registro.
              </p>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleEditGuardar} disabled={editGuardando}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#6366F1", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", fontSize: 14 }}>
                {editGuardando ? "Guardando…" : "Guardar cambios"}
              </button>
              <button onClick={() => setEditModal(null)}
                style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

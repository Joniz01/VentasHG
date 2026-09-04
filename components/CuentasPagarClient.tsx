"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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

const FORM_VACIO: FormData = {
  proveedor: "", proveedorRif: "", numeroFactura: "", descripcion: "",
  fechaEmision: HOY, fechaVencimiento: HOY, montoBs: "", montoUsd: "", tasaDia: "", notas: "",
  recurrente: false, frecuencia: "MENSUAL",
};

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

// ── Formulario con conversión bidireccional ────────────────────────────────

function FormularioCP({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (data: FormData) => Promise<string | null>;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<FormData>(FORM_VACIO);
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
        <CampoForm label="Proveedor *">
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

  // filtros
  const [filtroEstado, setFiltroEstado] = useState<"" | "PENDIENTE" | "PENDIENTE_PARCIAL" | "PAGADO">("");
  const [filtroProveedor, setFiltroProveedor] = useState("");

  // formulario
  const [showForm, setShowForm] = useState(false);

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

  // eliminación inline
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState(false);

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
      const r = await fetch(`/api/cuentas-pagar?${p}`);
      const j = await r.json();
      setItems((j.items ?? []) as CuentaPagar[]);
      setTotal(j.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, filtroEstado, filtroProveedor]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleGuardar(form: FormData): Promise<string | null> {
    const body = {
      proveedor: form.proveedor,
      proveedorRif: form.proveedorRif || undefined,
      numeroFactura: form.numeroFactura || undefined,
      descripcion: form.descripcion || undefined,
      fechaEmision: form.fechaEmision,
      fechaVencimiento: form.fechaVencimiento,
      montoBs: Number(form.montoBs) || 0,
      montoUsd: Number(form.montoUsd) || 0,
      tasaDia: Number(form.tasaDia) || 0,
      notas: form.notas || undefined,
      recurrente: form.recurrente,
      frecuencia: form.recurrente ? form.frecuencia : undefined,
    };
    const r = await fetch("/api/cuentas-pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) return j.error ?? "Error al guardar";
    setShowForm(false);
    setPage(1);
    cargar();
    return null;
  }

  // Fecha de pago → busca tasa histórica
  async function handleFechaPagoModal(fecha: string) {
    setFechaPago(fecha);
    if (!fecha) { setTasaPago(null); setTasaPagoEditable(false); setTasaPagoInput(""); return; }
    setBuscandoTasa(true);
    const tasa = await buscarTasaPorFecha(fecha);
    setBuscandoTasa(false);
    if (tasa) {
      setTasaPago(tasa);
      setTasaPagoInput(String(tasa));
      setTasaPagoEditable(false);
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
      if (montoParcialBs) setMontoParcialUsd((Number(montoParcialBs) / t).toFixed(4));
    }
  }

  // Conversión bidireccional en modal de pago parcial
  function handleParcialBs(val: string) {
    setMontoParcialBs(val);
    const t = tasaPago ?? pagoModal?.tasaDia;
    if (t && t > 0 && val) setMontoParcialUsd((Number(val) / t).toFixed(4));
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
          ? { accion: "pagar" }
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--erp-text)", margin: 0 }}>Cuentas por Pagar</h2>
          <p style={{ fontSize: 13, color: "var(--erp-text-2)", margin: "2px 0 0" }}>Obligaciones con proveedores</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ padding: "8px 18px", borderRadius: 10, background: "#B45309", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
        >
          {showForm ? "✕ Cancelar" : "+ Nueva Cuenta"}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <FormularioCP
          onGuardar={handleGuardar}
          onCancelar={() => setShowForm(false)}
        />
      )}

      {/* Filtros */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {(["", "PENDIENTE", "PENDIENTE_PARCIAL", "PAGADO"] as const).map(e => (
          <button key={e} onClick={() => { setFiltroEstado(e); setPage(1); }}
            style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filtroEstado === e ? "#B45309" : "var(--erp-border)"}`, background: filtroEstado === e ? "rgba(180,83,9,0.10)" : "var(--erp-surface)", color: filtroEstado === e ? "#B45309" : "var(--erp-text-2)", fontSize: 13, cursor: "pointer", fontWeight: filtroEstado === e ? 700 : 400 }}>
            {e === "" ? "Todos" : e === "PENDIENTE" ? "Pendiente" : e === "PENDIENTE_PARCIAL" ? "Pend. Parcial" : "Pagado"}
          </button>
        ))}
        <input
          placeholder="Buscar proveedor…"
          value={filtroProveedor}
          onChange={e => { setFiltroProveedor(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: 200, flex: "0 0 auto" }}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <p style={{ color: "var(--erp-text-3)", textAlign: "center", padding: "2rem 0" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--erp-text-3)", border: "1px dashed var(--erp-border)", borderRadius: 12, fontSize: 14 }}>
          Sin cuentas por pagar registradas.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--erp-border)", textAlign: "left" }}>
                {["Proveedor","Nº Factura","Emisión","Vencimiento","Monto Bs","Monto USD","Tasa","Estado","Acciones"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", fontWeight: 700, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(cp => {
                const est = ESTADO_STYLE[cp.estado] ?? ESTADO_STYLE.PENDIENTE;
                const esElim = eliminandoId === cp.id;
                return (
                  <tr key={cp.id} style={{ borderBottom: "1px solid var(--erp-border)", background: esElim ? "rgba(239,68,68,0.06)" : undefined }}>
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontWeight: 600, color: "var(--erp-text)", display: "flex", alignItems: "center", gap: 6 }}>
                        {cp.proveedor}
                        {cp.recurrente && (
                          <span title={`Recurrente ${cp.frecuencia ?? ""}`} style={{ fontSize: 11, background: "rgba(37,99,235,0.10)", color: "#2563EB", borderRadius: 10, padding: "1px 7px", fontWeight: 600 }}>
                            🔁 {cp.frecuencia}
                          </span>
                        )}
                      </div>
                      {cp.proveedorRif && <div style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{cp.proveedorRif}</div>}
                      {cp.descripcion && <div style={{ fontSize: 11, color: "var(--erp-text-3)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cp.descripcion}</div>}
                    </td>
                    <td style={{ padding: "10px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{cp.numeroFactura ?? "—"}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap" }}>{fmtFecha(cp.fechaEmision)}</td>
                    <td style={{ padding: "10px", whiteSpace: "nowrap", color: esPendiente(cp) && cp.fechaVencimiento < HOY ? "#EF4444" : "var(--erp-text)" }}>
                      {fmtFecha(cp.fechaVencimiento)}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {cp.montoOriginalBs ? (
                        <>
                          <span style={{ color: "var(--erp-text)" }}>{BS(cp.montoBs)}</span>
                          <span style={{ fontSize: 11, color: "var(--erp-text-3)", display: "block" }}>orig. {BS(cp.montoOriginalBs)}</span>
                        </>
                      ) : BS(cp.montoBs)}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--erp-text)" }}>
                      ${USD(cp.montoUsd)}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--erp-text-3)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {cp.tasaDia > 0 ? cp.tasaDia.toLocaleString("es-VE", { maximumFractionDigits: 2 }) : "—"}
                    </td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 20, background: est.bg, color: est.text, fontWeight: 700, fontSize: 12 }}>{est.label}</span>
                    </td>
                    <td style={{ padding: "10px" }}>
                      {esElim ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#EF4444" }}>¿Eliminar?</span>
                          <button onClick={() => handleEliminar(cp.id)} disabled={eliminando}
                            style={{ padding: "3px 10px", borderRadius: 6, background: "#EF4444", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                            {eliminando ? "…" : "Sí"}
                          </button>
                          <button onClick={() => setEliminandoId(null)}
                            style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--erp-border)", background: "transparent", color: "var(--erp-text)", cursor: "pointer", fontSize: 12 }}>No</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {esPendiente(cp) && (
                            <button
                              onClick={() => {
                                setPagoModal({ id: cp.id, montoBs: cp.montoBs, montoUsd: cp.montoUsd, tasaDia: cp.tasaDia, proveedor: cp.proveedor });
                                setTipoPago("total"); setMontoParcialBs(""); setMontoParcialUsd(""); setNuevaFechVenc(""); setNotaPago("");
                                setFechaPago(""); setTasaPago(null); setTasaPagoInput(""); setTasaPagoEditable(false);
                              }}
                              style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(5,150,105,0.10)", color: "#059669", border: "1px solid #059669", fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                              ✓ Registrar Pago
                            </button>
                          )}
                          <button
                            onClick={() => abrirEditar(cp)}
                            style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(99,102,241,0.08)", color: "#6366F1", border: "1px solid #6366F1", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                            ✏️
                          </button>
                          {cp.estado !== "PENDIENTE_PARCIAL" && (
                            <button
                              onClick={() => setEliminandoId(cp.id)}
                              style={{ padding: "4px 10px", borderRadius: 6, background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid #EF4444", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                              🗑
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
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

      {/* Modal Pago */}
      {pagoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--erp-surface)", borderRadius: 16, padding: 28, width: 440, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "var(--erp-text)" }}>Registrar Pago</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--erp-text-2)" }}>
              {pagoModal.proveedor} · <strong>${USD(pagoModal.montoUsd)}</strong> USD
              {pagoModal.tasaDia > 0 && <span style={{ color: "var(--erp-text-3)" }}> · Tasa {pagoModal.tasaDia.toLocaleString("es-VE", { maximumFractionDigits: 2 })} Bs/$</span>}
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

            {tipoPago === "parcial" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                {/* Conversión bidireccional en modal */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <CampoForm label="Monto a abonar (Bs)">
                    <input type="number" min="0" step="0.01" style={inputStyle} value={montoParcialBs}
                      onChange={e => handleParcialBs(e.target.value)} placeholder={`Máx. ${BS(pagoModal.montoBs)}`} />
                  </CampoForm>
                  <CampoForm label="Equivalente USD">
                    <input type="number" min="0" step="0.0001" style={inputStyle} value={montoParcialUsd}
                      onChange={e => handleParcialUsd(e.target.value)} placeholder="0.0000" />
                  </CampoForm>
                </div>
                {montoParcialUsd && pagoModal.montoUsd > 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: "var(--erp-text-3)" }}>
                    Restante: ${USD(Math.max(0, pagoModal.montoUsd - (Number(montoParcialUsd) || 0)))} USD
                  </p>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <CampoForm label="Fecha de pago">
                    <input type="date" style={inputStyle} value={fechaPago} onChange={e => handleFechaPagoModal(e.target.value)} />
                  </CampoForm>
                  <CampoForm label={tasaPagoEditable ? "Tasa Bs/$ (manual)" : "Tasa Bs/$"}>
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
                {!tasaPagoEditable && fechaPago && !buscandoTasa && tasaPago == null && (
                  <p style={{ margin: 0, fontSize: 12, color: "#D97706" }}>Sin tasa registrada — ingresa la tasa manualmente.</p>
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
                { label: "Proveedor *", key: "proveedor", type: "text" },
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

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

type ItemEstado = "vencido" | "pendiente" | "pendiente_parcial" | "programado" | "pagado";
type ItemTipo = "nomina" | "gasto" | "gasto-fijo" | "proveedor" | "compra";

type PagoHistorial = {
  id: number;
  fechaPago: string;
  montoUsd: number;
  montoBs: number;
  nota: string | null;
};

type ObligacionItem = {
  id: string;
  tipo: ItemTipo;
  descripcion: string;
  fechaVencimiento: string;
  montoBs: number;
  montoUsd: number;
  montoOriginalUsd?: number;
  estado: ItemEstado;
  referencia: string | null;
  estimado?: boolean;
  historialPagos?: PagoHistorial[];
};

type DrillKey = "proxima_semana" | "vencido" | "esta_semana" | "prox_4sem" | "pagado_mes" | "proveedores" | "compras";

type Semana = { lunes: string; domingo: string; totalUsd: number; tipos: string[] };

type PlanificacionData = {
  kpis: { vencidoUsd: number; estaSemanaUsd: number; proximaSemanaUsd: number; esteMesUsd: number; pagadoUsd: number; proveedoresUsd?: number; comprasUsd?: number };
  items: ObligacionItem[];
  semanas: Semana[];
  hoy: string;
  lunes: string;
  domingo: string;
  lunesProx: string;
  domingoProx: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const USD = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BS = (n: number) =>
  n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Semantic colour maps ───────────────────────────────────────────────────

const ESTADO_COLOR: Record<ItemEstado, { text: string; bg: string; border: string; label: string }> = {
  vencido:           { text: "#EF4444", bg: "rgba(239,68,68,0.09)",    border: "#EF4444", label: "Vencido" },
  pendiente:         { text: "#D97706", bg: "rgba(217,119,6,0.09)",    border: "#D97706", label: "Esta semana" },
  pendiente_parcial: { text: "#B45309", bg: "rgba(180,83,9,0.09)",     border: "#B45309", label: "Pend. Parcial" },
  programado:        { text: "#2563EB", bg: "rgba(37,99,235,0.09)",    border: "#2563EB", label: "Programado" },
  pagado:            { text: "#059669", bg: "rgba(5,150,105,0.09)",    border: "#059669", label: "Pagado" },
};

const TIPO_COLOR: Record<ItemTipo, { text: string; bg: string; label: string }> = {
  nomina:      { text: "#7C3AED", bg: "#EDE9FE", label: "Nómina" },
  "gasto-fijo":{ text: "#0891B2", bg: "#E0F2FE", label: "Gasto Fijo" },
  gasto:       { text: "#B45309", bg: "#FEF3C7", label: "Gasto" },
  proveedor:   { text: "#374151", bg: "#F3F4F6", label: "Servicio" },
  compra:      { text: "#0F5FA6", bg: "#DDEEFF", label: "Compra Créd." },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label, valueUsd, color, subLabel, onClick, active,
}: {
  label: string;
  valueUsd: number;
  color: string;
  subLabel?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{
        flex: "1 1 180px",
        padding: "16px 20px",
        borderRadius: 12,
        background: active ? `${color}12` : "var(--erp-surface)",
        border: `${active ? 2 : 1}px solid ${active ? color : "var(--erp-border)"}`,
        borderTop: `3px solid ${color}`,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s",
        outline: "none",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 600, color: active ? color : "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label} {active && "↓"}
      </p>
      <p style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        ${USD(valueUsd)}
      </p>
      {subLabel && (
        <p style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 4 }}>{subLabel}</p>
      )}
    </div>
  );
}

function sourceUrl(item: ObligacionItem): string | null {
  if (item.id.startsWith("G")) return "/gastos";
  if (item.id.startsWith("CP")) return "/cuentas-por-pagar";
  if (item.id.startsWith("NE")) return "/nomina"; // estimated → config nomina
  if (item.id.startsWith("N")) return "/nomina";  // period → gestión pagos
  if (item.id.startsWith("COMP")) return "/compras";
  return null;
}

function TipoPill({ tipo }: { tipo: ItemTipo }) {
  const c = TIPO_COLOR[tipo] ?? TIPO_COLOR.gasto;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: c.bg,
        color: c.text,
      }}
    >
      {c.label.toUpperCase()}
    </span>
  );
}

function EstadoPill({ estado }: { estado: ItemEstado }) {
  const c = ESTADO_COLOR[estado];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}22`,
      }}
    >
      {c.label.toUpperCase()}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type FiltroEstado = "todos" | "vencido" | "pendiente" | "programado" | "pagado";

type PagoModal = {
  itemId: string;
  montoUsd: number;
  montoBs: number;
  tasaDia: number;
  descripcion: string;
};

export default function TesoreriaClient() {
  const router = useRouter();
  const [data, setData] = useState<PlanificacionData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [pagando, setPagando] = useState<string | null>(null);
  const [drillKey, setDrillKey] = useState<DrillKey | null>(null);

  // Pago modal state
  const [pagoModal, setPagoModal] = useState<PagoModal | null>(null);
  const [tipoPago, setTipoPago] = useState<"total" | "parcial">("total");
  const [montoParcialUsd, setMontoParcialUsd] = useState("");
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [notaPago, setNotaPago] = useState("");
  const [expandedHistorial, setExpandedHistorial] = useState<string | null>(null);
  const [eliminandoConfirm, setEliminandoConfirm] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/tesoreria/planificacion");
      if (res.ok) setData(await res.json());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirPagoModal = (item: ObligacionItem) => {
    if (!item.id.startsWith("G")) return;
    setPagoModal({ itemId: item.id, montoUsd: item.montoUsd, montoBs: item.montoBs, tasaDia: item.montoBs > 0 && item.montoUsd > 0 ? item.montoBs / item.montoUsd : 1, descripcion: item.descripcion });
    setTipoPago("total");
    setMontoParcialUsd("");
    setNuevaFecha("");
    setNotaPago("");
  };

  const cerrarPagoModal = () => setPagoModal(null);

  const confirmarPago = async () => {
    if (!pagoModal) return;
    setPagando(pagoModal.itemId);
    try {
      const body: Record<string, unknown> = { id: pagoModal.itemId };
      if (tipoPago === "parcial") {
        body.parcial = {
          montoPagadoUsd: Number(montoParcialUsd),
          nuevaFecha,
          nota: notaPago || undefined,
        };
      }
      await fetch("/api/tesoreria/planificacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      cerrarPagoModal();
      await cargar();
    } finally {
      setPagando(null);
    }
  };

  const eliminarGasto = async (id: string) => {
    setEliminando(id);
    try {
      await fetch("/api/tesoreria/planificacion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEliminandoConfirm(null);
      await cargar();
    } finally {
      setEliminando(null);
    }
  };

  if (cargando && !data) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
        Cargando planificación…
      </div>
    );
  }

  if (!data) return null;

  const { kpis, items, semanas, lunes: semLunes, domingo, lunesProx, domingoProx } = data;

  const esPendiente = (i: ObligacionItem) => i.estado === "pendiente" || i.estado === "pendiente_parcial";

  // Drill-down filter
  const drillItems: ObligacionItem[] | null = (() => {
    if (!drillKey) return null;
    if (drillKey === "vencido") return items.filter((i) => i.estado === "vencido");
    if (drillKey === "esta_semana") return items.filter((i) => i.fechaVencimiento >= semLunes && i.fechaVencimiento <= domingo);
    if (drillKey === "proxima_semana") return items.filter((i) => i.fechaVencimiento >= lunesProx && i.fechaVencimiento <= domingoProx);
    if (drillKey === "prox_4sem") return items.filter((i) => i.estado !== "vencido" && i.estado !== "pagado");
    if (drillKey === "pagado_mes") return items.filter((i) => i.estado === "pagado");
    if (drillKey === "proveedores") return items.filter((i) => i.id.startsWith("CP"));
    if (drillKey === "compras") return items.filter((i) => i.id.startsWith("COMP"));
    return null;
  })();

  const displayItems = drillItems ?? items;

  // Filter + counts — pendiente_parcial cuenta junto a pendiente
  const counts: Record<FiltroEstado, number> = {
    todos: displayItems.length,
    vencido: displayItems.filter((i) => i.estado === "vencido").length,
    pendiente: displayItems.filter((i) => esPendiente(i)).length,
    programado: displayItems.filter((i) => i.estado === "programado").length,
    pagado: 0,
  };
  const filtrados = filtro === "todos"
    ? displayItems
    : filtro === "pendiente"
      ? displayItems.filter((i) => esPendiente(i))
      : displayItems.filter((i) => i.estado === filtro);

  const DRILL_LABELS: Record<DrillKey, string> = {
    proxima_semana: "Próxima Semana",
    vencido: "Vencido",
    esta_semana: "Esta Semana",
    prox_4sem: "Próximas 4 Semanas",
    pagado_mes: "Pagado · Mes",
    proveedores: "Proveedores",
    compras: "Compras a Crédito",
  };

  // Timeline scale
  const maxSem = Math.max(...semanas.map((s) => s.totalUsd), 1);

  const FILTROS: { key: FiltroEstado; label: string; color: string }[] = [
    { key: "todos",      label: "Todos",        color: "var(--erp-primary)" },
    { key: "vencido",    label: "Vencidos",     color: "#EF4444" },
    { key: "pendiente",  label: "Esta Semana",  color: "#D97706" },
    { key: "programado", label: "Programados",  color: "#2563EB" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        .tsr-table-header {
          display: grid;
          grid-template-columns: 1fr 90px 100px 80px 100px 130px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--erp-border);
          background: var(--erp-surface);
        }
        .tsr-table-row {
          display: grid;
          grid-template-columns: 1fr 90px 100px 80px 100px 130px;
          padding: 11px 16px;
          align-items: center;
        }
        .tsr-cell-bs   { display: block; }
        .tsr-cell-tipo { display: block; }
        .tsr-mobile-meta { display: none; }
        @media (max-width: 640px) {
          .tsr-table-header { display: none; }
          .tsr-table-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px 14px;
          }
          .tsr-cell-tipo { display: none; }
          .tsr-cell-bs   { display: none; }
          .tsr-cell-usd  { font-size: 15px !important; font-weight: 800 !important; }
          .tsr-cell-venc { font-size: 12px !important; }
          .tsr-cell-btn  { align-self: stretch; }
          .tsr-mobile-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
        }
      `}</style>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <KpiCard label="Próxima Semana" valueUsd={kpis.proximaSemanaUsd} color="#7C3AED" subLabel={`${fmtFecha(lunesProx)} – ${fmtFecha(domingoProx)}`} active={drillKey === "proxima_semana"} onClick={() => setDrillKey(drillKey === "proxima_semana" ? null : "proxima_semana")} />
        <KpiCard label="Vencido"     valueUsd={kpis.vencidoUsd}    color="#EF4444" subLabel="Requiere atención inmediata" active={drillKey === "vencido"}       onClick={() => setDrillKey(drillKey === "vencido" ? null : "vencido")} />
        <KpiCard label="Esta Semana" valueUsd={kpis.estaSemanaUsd} color="#D97706" subLabel={`Semana en curso · ${fmtFecha(semLunes)} – ${fmtFecha(domingo)}`} active={drillKey === "esta_semana"} onClick={() => setDrillKey(drillKey === "esta_semana" ? null : "esta_semana")} />
        <KpiCard label="Próx. 4 Sem" valueUsd={kpis.esteMesUsd}   color="#2563EB" subLabel="Ventana de planificación" active={drillKey === "prox_4sem"}     onClick={() => setDrillKey(drillKey === "prox_4sem" ? null : "prox_4sem")} />
        <KpiCard label="Pagado · Mes" valueUsd={kpis.pagadoUsd}    color="#059669" subLabel="Mes en curso" active={drillKey === "pagado_mes"}    onClick={() => setDrillKey(drillKey === "pagado_mes" ? null : "pagado_mes")} />
        {(kpis.proveedoresUsd ?? 0) > 0 && (
          <KpiCard label="Proveedores y Servicios" valueUsd={kpis.proveedoresUsd ?? 0} color="#374151" subLabel="CxP pendiente con proveedores y servicios" active={drillKey === "proveedores"} onClick={() => setDrillKey(drillKey === "proveedores" ? null : "proveedores")} />
        )}
        {(kpis.comprasUsd ?? 0) > 0 && (
          <KpiCard label="Compras a Crédito" valueUsd={kpis.comprasUsd ?? 0} color="#0F5FA6" subLabel="Compras con vencimiento próximo" active={drillKey === "compras"} onClick={() => setDrillKey(drillKey === "compras" ? null : "compras")} />
        )}
      </div>

      {/* ── Drill breadcrumb ───────────────────────────────────────────── */}
      {drillKey && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setDrillKey(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--erp-primary)", fontWeight: 600, padding: 0 }}
          >
            ← Ver todos
          </button>
          <span style={{ fontSize: 13, color: "var(--erp-text-2)" }}>
            Mostrando: <strong>{DRILL_LABELS[drillKey]}</strong> — {displayItems.length} ítem{displayItems.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── Cash Flow Timeline ─────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--erp-surface)",
          border: "1px solid var(--erp-border)",
          borderRadius: 12,
          padding: "16px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Flujo de Compromisos · Próximas 4 Semanas
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--erp-text-3)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#D97706", display: "inline-block" }} /> Esta semana
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--erp-text-3)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#2563EB", display: "inline-block" }} /> Próximas
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          {semanas.map((sem, i) => {
            const isThisWeek = sem.lunes === semLunes;
            const color = isThisWeek ? "#D97706" : "#2563EB";
            const barHeight = Math.max(40, (sem.totalUsd / maxSem) * 120);
            const TIPO_LABELS: Record<string, string> = {
              nomina: "NÓM", "gasto-fijo": "FIJO", gasto: "GASTO", proveedor: "PROV", compra: "COMP",
            };
            const TIPO_BG: Record<string, string> = {
              nomina: "#7C3AED", "gasto-fijo": "#0891B2", gasto: "#B45309", proveedor: "#374151", compra: "#0F5FA6",
            };
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {/* Bar block */}
                <div
                  style={{
                    height: barHeight,
                    borderRadius: 8,
                    background: sem.totalUsd > 0
                      ? `linear-gradient(160deg, ${color}dd, ${color}99)`
                      : "var(--erp-border)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "8px 4px",
                    transition: "height 0.35s ease",
                    opacity: sem.totalUsd > 0 ? 1 : 0.35,
                  }}
                >
                  {sem.totalUsd > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", textAlign: "center" }}>
                      ${USD(sem.totalUsd)}
                    </span>
                  )}
                </div>
                {/* Week label */}
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: isThisWeek ? color : "var(--erp-text-2)", marginBottom: 1 }}>
                    {isThisWeek ? "Esta sem." : `${fmtFecha(sem.lunes).slice(0, 5)}–${fmtFecha(sem.domingo).slice(0, 5)}`}
                  </p>
                  {/* Type chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                    {sem.tipos.map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: 3,
                          background: TIPO_BG[t] ?? "#6B7280",
                          color: "#fff",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {TIPO_LABELS[t] ?? t.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Filter Chips ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: "5px 14px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border: `1.5px solid ${active ? f.color : "var(--erp-border)"}`,
                background: active ? f.color : "var(--erp-surface)",
                color: active ? "#fff" : "var(--erp-text-2)",
                transition: "all 0.15s",
              }}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: active ? "rgba(255,255,255,0.25)" : "var(--erp-border)",
                    color: active ? "#fff" : "var(--erp-text-3)",
                    borderRadius: 99,
                    padding: "0 6px",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {counts[f.key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Obligations Table ──────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--erp-surface)",
          border: "1px solid var(--erp-border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Table header — hidden on mobile via CSS */}
        <div className="tsr-table-header">
          {["Descripción", "Tipo", "Vencimiento", "USD", "Bs.", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </span>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>
            {filtro === "todos"
              ? "No hay obligaciones en la ventana de planificación."
              : `Sin obligaciones en estado "${FILTROS.find((f) => f.key === filtro)?.label}".`}
          </div>
        ) : (
          filtrados.map((item, idx) => {
            const estadoC = ESTADO_COLOR[item.estado];
            const isLast = idx === filtrados.length - 1;
            const url = sourceUrl(item);
            return (
              <div
                key={item.id}
                className="tsr-table-row"
                onClick={url ? () => router.push(url) : undefined}
                style={{
                  borderBottom: isLast ? "none" : "1px solid var(--erp-border)",
                  borderLeft: `3px solid ${estadoC.border}`,
                  background: idx % 2 === 0 ? "transparent" : "rgba(0,0,0,0.015)",
                  cursor: url ? "pointer" : "default",
                }}
              >
                {/* Descripción */}
                <div className="tsr-cell-desc">
                  <div className="tsr-mobile-meta">
                    <TipoPill tipo={item.tipo as ItemTipo} />
                    <EstadoPill estado={item.estado} />
                  </div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--erp-text)", lineHeight: 1.3, marginTop: 4 }}>
                    {item.descripcion}
                  </p>
                  {item.estado === "pendiente_parcial" && item.montoOriginalUsd != null && (
                    <p style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
                      Original: ${USD(item.montoOriginalUsd)} · Saldo: ${USD(item.montoUsd)}
                    </p>
                  )}
                  {item.referencia && (
                    <p style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 2 }}>
                      Ref: {item.referencia}
                    </p>
                  )}
                  {/* Historial de pagos parciales */}
                  {item.estado === "pendiente_parcial" && item.historialPagos && item.historialPagos.length > 0 && (
                    <div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedHistorial(expandedHistorial === item.id ? null : item.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#B45309", fontWeight: 600, padding: "2px 0", marginTop: 3 }}
                      >
                        {expandedHistorial === item.id ? "▲ Ocultar historial" : `▼ Ver ${item.historialPagos.length} abono(s)`}
                      </button>
                      {expandedHistorial === item.id && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          {item.historialPagos.map((h) => (
                            <div key={h.id} style={{ fontSize: 11, color: "var(--erp-text-2)", background: "rgba(180,83,9,0.06)", borderRadius: 6, padding: "4px 8px", display: "flex", gap: 8 }}>
                              <span>{fmtFecha(h.fechaPago)}</span>
                              <span style={{ fontWeight: 700, color: "#059669" }}>${USD(h.montoUsd)}</span>
                              {h.nota && <span style={{ color: "var(--erp-text-3)" }}>{h.nota}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tipo */}
                <div className="tsr-cell-tipo">
                  <TipoPill tipo={item.tipo as ItemTipo} />
                </div>

                {/* Vencimiento */}
                <span className="tsr-cell-venc" style={{ fontSize: 12, fontWeight: 600, color: estadoC.text, fontVariantNumeric: "tabular-nums" }}>
                  📅 {fmtFecha(item.fechaVencimiento)}
                </span>

                {/* USD */}
                <span className="tsr-cell-usd" style={{ fontSize: 13, fontWeight: 800, color: "var(--erp-text)", fontVariantNumeric: "tabular-nums" }}>
                  ${USD(item.montoUsd)}
                </span>

                {/* Bs */}
                <span className="tsr-cell-bs" style={{ fontSize: 11, color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>
                  Bs.{BS(item.montoBs)}
                </span>

                {/* Acción */}
                <div className="tsr-cell-btn" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {item.estado !== "pagado" && item.id.startsWith("G") && eliminandoConfirm !== item.id ? (
                    <>
                      <button
                        onClick={() => abrirPagoModal(item)}
                        disabled={pagando === item.id}
                        style={{
                          padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                          cursor: pagando === item.id ? "wait" : "pointer",
                          border: "1.5px solid #059669", background: "transparent", color: "#059669",
                          opacity: pagando === item.id ? 0.6 : 1, transition: "all 0.15s",
                          whiteSpace: "nowrap", width: "100%",
                        }}
                      >
                        {pagando === item.id ? "…" : "✓ Registrar Pago"}
                      </button>
                      <button
                        onClick={() => setEliminandoConfirm(item.id)}
                        disabled={item.estado === "pendiente_parcial"}
                        title={item.estado === "pendiente_parcial" ? "Tiene abonos registrados — no se puede eliminar" : "Eliminar gasto"}
                        style={{
                          padding: "4px 8px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                          cursor: item.estado === "pendiente_parcial" ? "not-allowed" : "pointer",
                          border: "1.5px solid #EF4444", background: "transparent", color: "#EF4444",
                          opacity: item.estado === "pendiente_parcial" ? 0.35 : 0.7,
                          transition: "all 0.15s", width: "100%",
                        }}
                      >
                        🗑 Eliminar
                      </button>
                    </>
                  ) : eliminandoConfirm === item.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <p style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, margin: 0, textAlign: "center" }}>¿Eliminar este gasto?</p>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          onClick={() => setEliminandoConfirm(null)}
                          style={{
                            flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            cursor: "pointer", border: "1.5px solid var(--erp-border)",
                            background: "transparent", color: "var(--erp-text-2)",
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => eliminarGasto(item.id)}
                          disabled={eliminando === item.id}
                          style={{
                            flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            cursor: eliminando === item.id ? "wait" : "pointer",
                            border: "none", background: "#EF4444", color: "#fff",
                            opacity: eliminando === item.id ? 0.6 : 1,
                          }}
                        >
                          {eliminando === item.id ? "…" : "Sí, eliminar"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {/* Footer totals */}
        {filtrados.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 24,
              padding: "10px 16px",
              borderTop: "1px solid var(--erp-border)",
              background: "var(--erp-bg, var(--erp-surface))",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>
              {filtrados.length} obligación{filtrados.length !== 1 ? "es" : ""}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--erp-text)", fontVariantNumeric: "tabular-nums" }}>
              Total: ${USD(filtrados.reduce((s, i) => s + i.montoUsd, 0))}
            </span>
          </div>
        )}
      </div>

      {/* ── Modal de pago ──────────────────────────────────────────────── */}
      {pagoModal && (
        <div
          onClick={cerrarPagoModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--erp-surface)", borderRadius: 14,
              padding: "24px 20px", width: "100%", maxWidth: 400,
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-text)", margin: 0 }}>
              Registrar Pago
            </p>
            <p style={{ fontSize: 11, color: "var(--erp-text-3)", margin: 0, lineHeight: 1.4 }}>
              {pagoModal.descripcion}
            </p>
            <p style={{ fontSize: 13, fontWeight: 800, color: "var(--erp-text)", margin: 0 }}>
              Saldo pendiente: <span style={{ color: "#EF4444" }}>${USD(pagoModal.montoUsd)}</span>
            </p>

            {/* Toggle total / parcial */}
            <div style={{ display: "flex", gap: 8 }}>
              {(["total", "parcial"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoPago(t)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                    cursor: "pointer", transition: "all 0.15s",
                    border: `1.5px solid ${tipoPago === t ? "#059669" : "var(--erp-border)"}`,
                    background: tipoPago === t ? "#059669" : "transparent",
                    color: tipoPago === t ? "#fff" : "var(--erp-text-2)",
                  }}
                >
                  {t === "total" ? "Pago Total" : "Pago Parcial"}
                </button>
              ))}
            </div>

            {tipoPago === "parcial" && (
              <>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-3)", display: "block", marginBottom: 5 }}>
                    Monto a pagar (USD)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={pagoModal.montoUsd}
                    step="0.01"
                    value={montoParcialUsd}
                    onChange={(e) => setMontoParcialUsd(e.target.value)}
                    placeholder={`Máx. $${USD(pagoModal.montoUsd)}`}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                      border: "1.5px solid var(--erp-border)", background: "var(--erp-bg, var(--erp-surface))",
                      color: "var(--erp-text)", boxSizing: "border-box",
                    }}
                  />
                  {montoParcialUsd && Number(montoParcialUsd) > 0 && (
                    <p style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 4 }}>
                      Saldo restante: ${USD(pagoModal.montoUsd - Number(montoParcialUsd))}
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-3)", display: "block", marginBottom: 5 }}>
                    Nueva fecha de vencimiento del saldo
                  </label>
                  <input
                    type="date"
                    value={nuevaFecha}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                      border: "1.5px solid var(--erp-border)", background: "var(--erp-bg, var(--erp-surface))",
                      color: "var(--erp-text)", boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-3)", display: "block", marginBottom: 5 }}>
                    Nota (opcional)
                  </label>
                  <input
                    type="text"
                    value={notaPago}
                    onChange={(e) => setNotaPago(e.target.value)}
                    placeholder="Ej: Abono 1 de 2"
                    style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                      border: "1.5px solid var(--erp-border)", background: "var(--erp-bg, var(--erp-surface))",
                      color: "var(--erp-text)", boxSizing: "border-box",
                    }}
                  />
                </div>
              </>
            )}

            {/* Botones */}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                onClick={cerrarPagoModal}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "1.5px solid var(--erp-border)",
                  background: "transparent", color: "var(--erp-text-2)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPago}
                disabled={
                  pagando !== null ||
                  (tipoPago === "parcial" && (!montoParcialUsd || Number(montoParcialUsd) <= 0 || !nuevaFecha))
                }
                style={{
                  flex: 2, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: pagando ? "wait" : "pointer",
                  border: "none", background: "#059669", color: "#fff",
                  opacity: pagando ? 0.7 : 1, transition: "opacity 0.15s",
                }}
              >
                {pagando ? "Procesando…" : tipoPago === "total" ? "✓ Confirmar Pago Total" : "✓ Confirmar Abono"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

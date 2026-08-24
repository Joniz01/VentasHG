"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────
type MesTrend = {
  mes: string;
  label: string;
  ingresos: number;
  cogs: number;
  nomina: number;
  opex: number;
  cortesias: number;
  gananciaBruta: number;
  gastosOp: number;
  utilidad: number;
  margenBruto: number;
  margenNeto: number;
};

type Deltas = {
  ingresos: number | null;
  gananciaBruta: number | null;
  gastosOp: number | null;
  utilidad: number | null;
  margenNeto: number | null;
};

type RentabilidadData = {
  mes: string;
  mesLabel: string;
  meses: string[];
  trend: MesTrend[];
  actual: MesTrend;
  anterior: MesTrend | null;
  deltas: Deltas;
  diasHabiles: number;
  ingresoDiario: number;
};

type IATipo = "rentabilidad" | "caja" | "eficiencia" | "asesor";

type ChatMsg = { role: "user" | "ia"; text: string; ts: string };

const TOGGLE_OPTS = [
  { key: "rentabilidad",  label: "📊 Rentabilidad",       color: "#3FB950" },
  { key: "caja",          label: "💰 Flujo de Caja",       color: "#58A6FF" },
  { key: "ventas",        label: "🛒 Ventas & Productos",  color: "#D29922" },
  { key: "costos",        label: "⚙️ Costos & Eficiencia", color: "#BC8CFF" },
  { key: "nomina",        label: "👷 Nómina & RRHH",       color: "#00B4D8" },
  { key: "inventario",    label: "📦 Inventario",          color: "#F85149" },
];

// ── Helpers ──────────────────────────────────────────────────────
function usd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(n: number, dec = 1): string { return n.toFixed(dec) + "%"; }
function deltaStr(d: number | null, suffix = "%"): { txt: string; up: boolean } | null {
  if (d === null) return null;
  return { txt: (d >= 0 ? "▲" : "▼") + " " + Math.abs(d).toFixed(1) + suffix, up: d >= 0 };
}
function now(): string {
  return new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}

// ── Sparkline SVG ─────────────────────────────────────────────────
function Spark({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return <svg width="120" height="28" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 120;
    const y = 24 - ((v - min) / range) * 20;
    return `${x},${y}`;
  });
  const last = pts[pts.length - 1];
  const [lx, ly] = last.split(",");
  return (
    <svg width="120" height="28" viewBox="0 0 120 28" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <polygon
        points={`${pts.join(" ")} 120,28 0,28`}
        fill={`url(#sg-${color.replace("#", "")})`}
      />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function AnalisisFinancieroClient() {
  const [mes, setMes] = useState<string>("");
  const [data, setData] = useState<RentabilidadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // IA states
  const [iaActivo, setIaActivo] = useState<IATipo | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaTexto, setIaTexto] = useState("");
  const [iaTs, setIaTs] = useState("");
  const [iaError, setIaError] = useState("");

  // Asesor chat
  const [toggles, setToggles] = useState<string[]>(["rentabilidad", "caja"]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [asesorLoading, setAsesorLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Load data ─────────────────────────────────────────────────
  const loadData = useCallback(async (m: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/analisis-financiero/rentabilidad?mes=${m}`);
      if (!r.ok) throw new Error("Error cargando datos");
      const d: RentabilidadData = await r.json();
      setData(d);
      if (!mes) setMes(d.mes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
    const m = hoy.slice(0, 7);
    setMes(m);
    loadData(m);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ── Run quick IA analysis ─────────────────────────────────────
  async function runIA(tipo: IATipo) {
    if (!data) return;
    if (iaActivo === tipo && iaTexto) { setIaActivo(null); setIaTexto(""); return; }
    setIaActivo(tipo);
    setIaTexto("");
    setIaError("");
    setIaLoading(true);
    try {
      const r = await fetch("/api/analisis-financiero/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, contexto: buildCtx(data, tipo), toggles }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Error IA");
      setIaTexto(d.texto);
      setIaTs(now());
    } catch (e) {
      setIaError(e instanceof Error ? e.message : "Error IA");
    } finally {
      setIaLoading(false);
    }
  }

  // ── Send asesor message ────────────────────────────────────────
  async function sendAsesor() {
    if (!pregunta.trim() || !data) return;
    const q = pregunta.trim();
    setPregunta("");
    const userMsg: ChatMsg = { role: "user", text: q, ts: now() };
    setChat((c) => [...c, userMsg]);
    setAsesorLoading(true);
    try {
      const r = await fetch("/api/analisis-financiero/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "asesor",
          contexto: buildCtx(data, "asesor"),
          pregunta: q,
          toggles,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Error IA");
      setChat((c) => [...c, { role: "ia", text: d.texto, ts: now() }]);
    } catch (e) {
      setChat((c) => [...c, { role: "ia", text: "⚠️ " + (e instanceof Error ? e.message : "Error"), ts: now() }]);
    } finally {
      setAsesorLoading(false);
    }
  }

  function buildCtx(d: RentabilidadData, tipo: IATipo) {
    const base = {
      mes: d.mesLabel,
      ingresos: d.actual.ingresos,
      cogs: d.actual.cogs,
      nomina: d.actual.nomina,
      opex: d.actual.opex,
      cortesias: d.actual.cortesias,
      gananciaBruta: d.actual.gananciaBruta,
      gastosOp: d.actual.gastosOp,
      utilidad: d.actual.utilidad,
      margenBruto: d.actual.margenBruto,
      margenNeto: d.actual.margenNeto,
      ingresoDiario: d.ingresoDiario,
      diasHabiles: d.diasHabiles,
      tendencia: d.trend.map((t) => ({ mes: t.label, ingresos: t.ingresos, utilidad: t.utilidad, margen: t.margenNeto })),
    };
    if (tipo === "caja") {
      return { ...base, mesAnterior: d.anterior };
    }
    return base;
  }

  // ── Render helpers ───────────────────────────────────────────
  function parseMd(text: string): React.ReactNode[] {
    // Replace **bold** and *italic* with spans
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let last = 0, m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>);
      else if (m[2]) parts.push(<em key={m.index}>{m[2]}</em>);
      last = re.lastIndex;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  function renderIaText(txt: string) {
    // Strip leading markdown headers (###, ##, #)
    const cleaned = txt.replace(/^#{1,4}\s*/gm, "");
    return cleaned.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 8 }} />;

      // Section header: line in ALL CAPS ending with colon, or ### stripped to caps
      const isHeader = /^[A-ZÁÉÍÓÚ\s·&]+:$/.test(trimmed) || /^[A-Z][A-Z\s]{4,}$/.test(trimmed);
      if (isHeader) {
        return (
          <p key={i} style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--erp-text-3)", margin: "14px 0 6px" }}>
            {trimmed}
          </p>
        );
      }

      // Action line → with arrow
      if (trimmed.startsWith("→") || trimmed.startsWith("->")) {
        return (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 10px", background: "rgba(88,166,255,.07)", borderRadius: 6, marginBottom: 4 }}>
            <span style={{ color: "#58A6FF", fontWeight: 700, flexShrink: 0 }}>→</span>
            <p style={{ fontSize: 12, color: "var(--erp-text)", lineHeight: 1.6, margin: 0 }}>
              {parseMd(trimmed.replace(/^→\s*|^->\s*/, ""))}
            </p>
          </div>
        );
      }

      // Numbered finding with emoji semaphore
      const finding = trimmed.match(/^(\d+)\.\s*(✅|⚠️|🔴|🟡|ℹ️)?\s*(.+)/);
      if (finding) {
        const emoji = finding[2] ?? "";
        const hasEmoji = !!finding[2];
        const borderColor = emoji === "✅" ? "#3FB950" : emoji === "⚠️" || emoji === "🟡" ? "#D29922" : emoji === "🔴" ? "#F85149" : "#58A6FF";
        return (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", background: "var(--erp-surface-2)", borderRadius: 8, borderLeft: `3px solid ${borderColor}`, marginBottom: 6 }}>
            {hasEmoji && <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{emoji}</span>}
            <p style={{ fontSize: 12, color: "var(--erp-text)", lineHeight: 1.6, margin: 0 }}>
              {parseMd(finding[3])}
            </p>
          </div>
        );
      }

      return (
        <p key={i} style={{ fontSize: 13, color: "var(--erp-text)", lineHeight: 1.65, marginBottom: 4 }}>
          {parseMd(trimmed)}
        </p>
      );
    });
  }

  const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  function prevMeses(mesActual: string): { label: string; value: string }[] {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(`${mesActual}-01`);
      d.setMonth(d.getMonth() - i);
      const ym = d.toISOString().slice(0, 7);
      const [y, m] = ym.split("-");
      result.push({ label: `${MESES_LABEL[parseInt(m) - 1]} ${y.slice(2)}`, value: ym });
    }
    return result;
  }

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--erp-text-3)", fontSize: 14 }}>
        Cargando análisis financiero…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#F85149", fontSize: 14 }}>
        {error || "Sin datos"}
      </div>
    );
  }

  const { actual, deltas, trend, diasHabiles, ingresoDiario } = data;

  // KPI cards
  const kpis = [
    {
      label: "Ingresos Brutos",
      value: usd(actual.ingresos),
      sub: `${diasHabiles} días hábiles · ${usd(ingresoDiario)}/día`,
      delta: deltaStr(deltas.ingresos),
      color: "#3FB950",
    },
    {
      label: "Ganancia Bruta",
      value: usd(actual.gananciaBruta),
      sub: `Margen bruto ${pct(actual.margenBruto)}`,
      delta: (() => { const d = deltas.gananciaBruta; return d !== null ? { txt: (d >= 0 ? "▲" : "▼") + " " + Math.abs(d).toFixed(1) + "%", up: d >= 0 } : null; })(),
      color: "#58A6FF",
    },
    {
      label: "Gastos Totales",
      value: usd(actual.gastosOp),
      sub: "Nómina + Op. + Cortesías",
      delta: (() => { const d = deltas.gastosOp; return d !== null ? { txt: (d >= 0 ? "▲" : "▼") + " " + Math.abs(d).toFixed(1) + "%", up: d < 0 } : null; })(),
      color: "#BC8CFF",
    },
    {
      label: "Utilidad Neta",
      value: usd(actual.utilidad),
      sub: "Mes en curso acumulado",
      delta: (() => { const d = deltas.utilidad; return d !== null ? { txt: (d >= 0 ? "▲" : "▼") + " " + Math.abs(d).toFixed(1) + "%", up: d >= 0 } : null; })(),
      color: "#3FB950",
    },
    {
      label: "Margen Operativo",
      value: pct(actual.margenNeto),
      sub: actual.margenNeto >= 30 ? "✓ Por encima de meta (30%)" : "Meta: 30%",
      delta: (() => { const d = deltas.margenNeto; return d !== null ? { txt: (d >= 0 ? "▲" : "▼") + " " + Math.abs(d).toFixed(1) + " pp", up: d >= 0 } : null; })(),
      color: "#58A6FF",
    },
  ];

  const wfTotal = actual.ingresos || 1;
  const wfRows = [
    { label: "Ingresos por Ventas", bold: true, color: "#3FB950", amount: actual.ingresos, pct: 100, indent: false },
    { label: "Compras / Materia Prima", bold: false, color: "#F85149", amount: -actual.cogs, pct: actual.ingresos > 0 ? actual.cogs / actual.ingresos * 100 : 0, indent: true },
    { label: "Ganancia Bruta", bold: true, color: "#58A6FF", amount: actual.gananciaBruta, pct: actual.margenBruto, indent: false, divider: true },
    { label: "Nómina (salarios)", bold: false, color: "#D29922", amount: -actual.nomina, pct: actual.ingresos > 0 ? actual.nomina / actual.ingresos * 100 : 0, indent: true },
    { label: "Gastos Operativos", bold: false, color: "#BC8CFF", amount: -actual.opex, pct: actual.ingresos > 0 ? actual.opex / actual.ingresos * 100 : 0, indent: true },
    { label: "Cortesías", bold: false, color: "#00B4D8", amount: -actual.cortesias, pct: actual.ingresos > 0 ? actual.cortesias / actual.ingresos * 100 : 0, indent: true },
    { label: "Utilidad Operativa", bold: true, color: "#3FB950", amount: actual.utilidad, pct: actual.margenNeto, indent: false, divider: true, highlight: true },
  ];

  const totalEgresos = actual.cogs + actual.nomina + actual.opex + actual.cortesias || 1;
  const donut = [
    { label: "Insumos",     val: actual.cogs,      color: "#F85149" },
    { label: "Gastos Op.",  val: actual.opex,      color: "#BC8CFF" },
    { label: "Nómina",      val: actual.nomina,    color: "#D29922" },
    { label: "Cortesías",   val: actual.cortesias, color: "#00B4D8" },
  ];

  // SVG donut
  const R = 35, CX = 45, CY = 45, CIRC = 2 * Math.PI * R;
  let offset = 0;
  const donutSegs = donut.map((d) => {
    const arc = (d.val / totalEgresos) * CIRC;
    const seg = { ...d, arc, offset, pctVal: totalEgresos > 0 ? d.val / totalEgresos * 100 : 0 };
    offset += arc;
    return seg;
  });

  const IA_BTNS: { tipo: IATipo; icon: string; label: string; desc: string; tags: string[]; color: string; glow: string }[] = [
    {
      tipo: "rentabilidad", icon: "💹",
      label: "Diagnóstico de Rentabilidad",
      desc: "Analiza márgenes bruto y neto, tendencia de compresión, relación COGS/Ingresos y cortesías. Genera un índice de salud 0–100.",
      tags: ["Márgenes", "P&L", "Tendencia"],
      color: "#58A6FF", glow: "rgba(88,166,255,.18)",
    },
    {
      tipo: "caja", icon: "💰",
      label: "Presión de Caja & Liquidez",
      desc: "Cruza compromisos próximos con flujo de ingresos. Calcula días de runway y detecta semanas de riesgo.",
      tags: ["Runway", "Liquidez", "Riesgo"],
      color: "#D29922", glow: "rgba(210,153,34,.18)",
    },
    {
      tipo: "eficiencia", icon: "⚙️",
      label: "Eficiencia Operativa",
      desc: "Mide ingreso por empleado, ratio nómina/ventas y productividad. Compara con benchmarks F&B/retail.",
      tags: ["Productividad", "Benchmarks", "Costos"],
      color: "#BC8CFF", glow: "rgba(188,140,255,.18)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1060 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 4 }}>Finanzas › Análisis Financiero</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--erp-text)", margin: 0 }}>Rentabilidad Mensual</h2>
          <p style={{ fontSize: 13, color: "var(--erp-text-2)", marginTop: 2 }}>
            Estado de Resultados consolidado · {data.mesLabel}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", border: "1px solid var(--erp-border)", borderRadius: 7, overflow: "hidden" }}>
            {prevMeses(mes).slice(-3).map((m) => (
              <button
                key={m.value}
                onClick={() => { setMes(m.value); loadData(m.value); setIaTexto(""); setIaActivo(null); }}
                style={{
                  padding: "6px 13px", fontSize: 12, border: "none", cursor: "pointer",
                  background: m.value === mes ? "var(--erp-surface-2)" : "none",
                  color: m.value === mes ? "var(--erp-text)" : "var(--erp-text-3)",
                  fontWeight: m.value === mes ? 700 : 400,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="af-kpi-strip">
        {kpis.map((k) => (
          <div key={k.label} style={{
            background: "var(--erp-surface)", border: "1px solid var(--erp-border)",
            borderRadius: 10, padding: "16px 18px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color }} />
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--erp-text-3)", margin: "0 0 8px" }}>{k.label}</p>
            <p style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: k.color, margin: 0 }}>{k.value}</p>
            <p style={{ fontSize: 11, color: "var(--erp-text-2)", marginTop: 3 }}>{k.sub}</p>
            {k.delta && (
              <p style={{ fontSize: 11, fontFamily: "monospace", color: k.delta.up ? "#3FB950" : "#F85149", marginTop: 5 }}>
                {k.delta.txt} vs mes ant.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* ── Main Grid: Waterfall + Right ── */}
      <div className="af-main-grid">

        {/* P&L Waterfall */}
        <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: "22px 24px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--erp-text-3)", marginBottom: 16 }}>
            Estado de Resultados · Cascada P&L
          </p>
          {wfRows.map((row, i) => (
            <div key={i}>
              {row.divider && <div style={{ height: 1, background: "var(--erp-border)", margin: "8px 0" }} />}
              <div className="af-wf-row">
                <p style={{
                  fontSize: row.bold ? 13 : 12, fontWeight: row.bold ? 700 : 400,
                  color: row.bold ? "var(--erp-text)" : "var(--erp-text-2)",
                  paddingLeft: row.indent ? 12 : 0, margin: 0,
                }}>
                  {row.label}
                </p>
                <div style={{ height: 22, background: "var(--erp-surface-2)", borderRadius: 4, overflow: "hidden", border: row.highlight ? `1px solid ${row.color}40` : "none" }}>
                  <div style={{
                    width: `${Math.min(100, Math.abs(row.pct))}%`,
                    height: "100%",
                    background: `linear-gradient(90deg,${row.color}cc,${row.color}55)`,
                    borderRadius: 4,
                    display: "flex", alignItems: "center", paddingLeft: 6,
                  }}>
                    {Math.abs(row.amount) > 0 && (
                      <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.85)", whiteSpace: "nowrap" }}>
                        {usd(Math.abs(row.amount))}
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: row.color, textAlign: "right", margin: 0 }}>
                  {row.amount >= 0 ? "" : "−"}{usd(Math.abs(row.amount))}
                </p>
                <p style={{ fontSize: 11, color: row.bold ? row.color : "var(--erp-text-3)", textAlign: "right", fontWeight: row.bold ? 700 : 400, margin: 0 }}>
                  {pct(Math.abs(row.pct), 1)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Donut */}
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--erp-text-3)", marginBottom: 12 }}>
              Composición de Egresos
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <svg width="90" height="90" viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
                {donutSegs.map((s, i) => (
                  <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth="14"
                    strokeDasharray={`${s.arc} ${CIRC - s.arc}`}
                    strokeDashoffset={-(s.offset - CIRC / 4)}
                    transform={`rotate(-90 ${CX} ${CY})`}
                  />
                ))}
                <text x={CX} y={CY - 4} textAnchor="middle" fill="#8B949E" fontSize="8" fontFamily="monospace">Total</text>
                <text x={CX} y={CY + 7} textAnchor="middle" fill="#E6EDF3" fontSize="9" fontWeight="600" fontFamily="monospace">
                  {usd(totalEgresos === 1 ? 0 : totalEgresos)}
                </text>
              </svg>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                {donutSegs.map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--erp-text-2)", flex: 1 }}>{s.label}</span>
                    <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "var(--erp-text)" }}>{usd(s.val)}</span>
                    <span style={{ fontSize: 10, color: "var(--erp-text-3)", minWidth: 32, textAlign: "right" }}>{pct(s.pctVal, 1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sparklines */}
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--erp-text-3)", marginBottom: 12 }}>
              Tendencia · Últimos 6 meses
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Ingresos", vals: trend.map((t) => t.ingresos), color: "#3FB950", end: usd(actual.ingresos) },
                { label: "G. Bruta", vals: trend.map((t) => t.gananciaBruta), color: "#58A6FF", end: usd(actual.gananciaBruta) },
                { label: "Utilidad", vals: trend.map((t) => t.utilidad), color: "#3FB950", end: usd(actual.utilidad) },
                { label: "Margen %", vals: trend.map((t) => t.margenNeto), color: "#8B949E", end: pct(actual.margenNeto) },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--erp-text-2)", minWidth: 68 }}>{s.label}</span>
                  <Spark values={s.vals} color={s.color} />
                  <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: s.color, minWidth: 50, textAlign: "right" }}>{s.end}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── P&L Table ── */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="af-pl-head">
          {["Concepto", ...(data.trend.slice(-3).map((t) => t.label)), "Var. MoM", "% Ing."].map((h, i) => (
            <p key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)", textAlign: i === 0 ? "left" : "right", margin: 0 }}>{h}</p>
          ))}
        </div>
        {[
          { label: "INGRESOS", bold: true, section: true, key: "ingresos", color: "#3FB950" },
          { label: "  Ventas directas", bold: false, indent: true, key: "ingresos", pctKey: "ingresos" },
          { label: "COSTO INSUMOS", bold: true, section: true, key: "cogs", neg: true },
          { label: "GANANCIA BRUTA", bold: true, total: true, key: "gananciaBruta", color: "#58A6FF" },
          { label: "GASTOS OPERATIVOS", bold: true, section: true, key: "gastosOp", neg: true },
          { label: "  Nómina", bold: false, indent: true, key: "nomina" },
          { label: "  Servicios / Alquiler", bold: false, indent: true, key: "opex" },
          { label: "  Cortesías", bold: false, indent: true, key: "cortesias" },
          { label: "UTILIDAD NETA", bold: true, total: true, key: "utilidad", color: "#3FB950" },
        ].map((row, i) => {
          const t3 = data.trend.slice(-3);
          const vals = t3.map((t) => (t as unknown as Record<string, number>)[row.key] ?? 0);
          const last = vals[vals.length - 1];
          const prev = vals[vals.length - 2];
          const mom = prev > 0 ? ((last - prev) / prev * 100).toFixed(1) : null;
          const pctIng = t3[t3.length - 1]?.ingresos > 0 ? (last / t3[t3.length - 1].ingresos * 100).toFixed(1) : null;
          const sign = row.neg ? "−" : "";
          const color = row.color ?? (row.neg ? "#F85149" : "var(--erp-text)");
          return (
            <div key={i} className="af-pl-row" style={{
              borderBottom: "1px solid var(--erp-border)",
              background: row.total ? "var(--erp-surface-2)" : row.section ? "rgba(255,255,255,.02)" : "none",
              alignItems: "center",
            }}>
              <p style={{ fontSize: 12, fontWeight: row.bold ? 700 : 400, color: row.bold ? color : "var(--erp-text-2)", paddingLeft: row.indent ? 14 : 0, margin: 0 }}>{row.label}</p>
              {vals.map((v, vi) => (
                <p key={vi} style={{ fontFamily: "monospace", fontSize: 12, color: row.neg ? "#F85149" : (row.color ?? "var(--erp-text)"), textAlign: "right", margin: 0 }}>
                  {sign}{usd(Math.abs(v))}
                </p>
              ))}
              <p style={{ fontFamily: "monospace", fontSize: 11, textAlign: "right", margin: 0, color: mom === null ? "var(--erp-text-3)" : Number(mom) >= 0 ? (row.neg ? "#F85149" : "#3FB950") : (row.neg ? "#3FB950" : "#F85149") }}>
                {mom ? (Number(mom) >= 0 ? "+" : "") + mom + "%" : "—"}
              </p>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "var(--erp-text-3)", textAlign: "right", margin: 0 }}>
                {pctIng ? pctIng + "%" : "—"}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Key metrics ── */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, padding: "22px 28px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--erp-text-3)", marginBottom: 16 }}>
          Indicadores Clave · {data.mesLabel}
        </p>
        <div className="af-anno-grid">
          {[
            {
              num: pct(actual.margenBruto),
              label: "Margen Bruto",
              desc: `Qué queda de cada $1 vendido después de pagar insumos. Referencia F&B: >60% = saludable. ${actual.margenBruto >= 60 ? "✅ Superado." : actual.margenBruto >= 55 ? "⚠️ Aceptable, mejorar." : "🔴 Por debajo del mínimo."}`,
            },
            {
              num: pct(actual.margenNeto),
              label: "Margen Operativo",
              desc: `Rentabilidad real descontando todos los gastos. Workday benchmark PYME: >20% = excelente, >30% = destacado. ${actual.margenNeto >= 30 ? "✅ Excelente." : actual.margenNeto >= 20 ? "✅ Bueno." : "⚠️ Por mejorar."}`,
            },
            {
              num: usd(ingresoDiario),
              label: "Ingreso Diario Promedio",
              desc: `Basado en ${diasHabiles} días hábiles del mes. Proyección de cierre: ${usd(ingresoDiario * diasHabiles)}. Permite anticipar tensiones de liquidez.`,
            },
          ].map((a) => (
            <div key={a.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <p style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 700, color: "var(--erp-accent, #58A6FF)", margin: 0 }}>{a.num}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-text)", margin: 0 }}>{a.label}</p>
              <p style={{ fontSize: 11, color: "var(--erp-text-2)", lineHeight: 1.5, margin: 0 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECCIÓN IA
      ══════════════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1px solid var(--erp-border)", paddingTop: 28 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--erp-text-3)", margin: "0 0 4px" }}>
              Inteligencia Artificial · Asistencia Financiera
            </p>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--erp-text)", margin: "0 0 4px" }}>Análisis IA del Negocio</h3>
            <p style={{ fontSize: 13, color: "var(--erp-text-2)", margin: 0, maxWidth: 540 }}>
              Diagnósticos predefinidos y asesor conversacional — solo analiza datos registrados en tu empresa.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--erp-text-3)" }}>
            <span>🔒</span> Solo datos de tu empresa · Sin información externa
          </div>
        </div>

        {/* 3 Quick Buttons */}
        <div className="af-ia-grid">
          {IA_BTNS.map((btn) => {
            const isActive = iaActivo === btn.tipo;
            return (
              <div key={btn.tipo} style={{
                background: "var(--erp-surface)",
                border: `1px solid ${isActive ? btn.color : "var(--erp-border)"}`,
                borderRadius: 12, padding: "18px 18px 16px",
                cursor: "pointer",
                boxShadow: isActive ? `0 0 20px ${btn.glow}` : "none",
                borderTop: `3px solid ${btn.color}`,
                position: "relative",
                transition: "border-color .15s, box-shadow .15s",
              }}
                onClick={() => { if (!iaLoading) runIA(btn.tipo); }}
              >
                <span style={{ fontSize: 20, display: "block", marginBottom: 8 }}>{btn.icon}</span>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-text)", margin: "0 0 5px" }}>{btn.label}</p>
                <p style={{ fontSize: 11, color: "var(--erp-text-2)", lineHeight: 1.5, margin: "0 0 10px" }}>{btn.desc}</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                  {btn.tags.map((t) => (
                    <span key={t} style={{
                      fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em",
                      padding: "2px 7px", borderRadius: 99,
                      background: `${btn.color}18`, color: btn.color, border: `1px solid ${btn.color}30`,
                    }}>{t}</span>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); if (!iaLoading) runIA(btn.tipo); }}
                  disabled={iaLoading && iaActivo === btn.tipo}
                  style={{
                    width: "100%", padding: "7px 14px", borderRadius: 7, border: `1px solid ${btn.color}`,
                    background: `${btn.color}12`, color: btn.color,
                    fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "background .15s",
                  }}
                >
                  {iaLoading && iaActivo === btn.tipo ? "Analizando…" : isActive && iaTexto ? "✓ Ver resultado" : "▶ Ejecutar análisis"}
                </button>
              </div>
            );
          })}
        </div>

        {/* IA Result Panel */}
        {(iaLoading || iaTexto || iaError) && iaActivo && iaActivo !== "asesor" && (
          <div style={{
            background: "var(--erp-surface)", border: "1px solid #2F4A6B",
            borderRadius: 12, overflow: "hidden", marginBottom: 16,
            boxShadow: "0 0 32px rgba(88,166,255,.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", background: "var(--erp-surface-2)", borderBottom: "1px solid var(--erp-border)" }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: "#58A6FF",
                boxShadow: "0 0 8px #58A6FF",
                animation: iaLoading ? "pulse 1.5s infinite" : "none",
              }} />
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--erp-text)", flex: 1, margin: 0 }}>
                {IA_BTNS.find((b) => b.tipo === iaActivo)?.label} · {data.mesLabel}
              </p>
              {iaTs && <span style={{ fontSize: 10, color: "var(--erp-text-3)" }}>Generado a las {iaTs}</span>}
            </div>
            <div style={{ padding: "18px 22px" }}>
              {iaLoading && (
                <p style={{ fontSize: 13, color: "var(--erp-text-2)", fontStyle: "italic" }}>Analizando datos del negocio…</p>
              )}
              {iaError && (
                <p style={{ fontSize: 13, color: "#F85149" }}>⚠️ {iaError}</p>
              )}
              {iaTexto && !iaLoading && (
                <div>{renderIaText(iaTexto)}</div>
              )}
            </div>
          </div>
        )}

        {/* ── Asesor IA ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(88,166,255,.04) 0%, rgba(88,166,255,.09) 100%)",
          border: "1px solid #2F4A6B",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 4px 32px rgba(88,166,255,.06), inset 0 1px 0 rgba(88,166,255,.05)",
        }}>
          {/* Top */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "22px 24px 0", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", padding: "3px 10px", borderRadius: 5, background: "rgba(88,166,255,.12)", color: "#58A6FF", border: "1px solid rgba(88,166,255,.2)" }}>
                  Asesor IA
                </span>
                <span style={{ fontSize: 10, color: "var(--erp-text-3)", padding: "3px 10px", border: "1px solid var(--erp-border)", borderRadius: 5 }}>
                  🔒 Solo datos de tu empresa
                </span>
              </div>
              <h4 style={{ fontSize: 17, fontWeight: 700, color: "var(--erp-text)", margin: "0 0 4px" }}>Pregúntale al negocio</h4>
              <p style={{ fontSize: 12, color: "var(--erp-text-2)", lineHeight: 1.5, margin: 0, maxWidth: 480 }}>
                Consulta cualquier aspecto financiero u operativo. El asesor responde solo con información real de tu empresa.
              </p>
            </div>
            <div style={{ background: "var(--erp-surface-2)", border: "1px solid #2F4A6B", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "var(--erp-text-2)", maxWidth: 200, flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--erp-text-3)", marginBottom: 5 }}>Restricción de alcance</p>
              Solo analiza: ventas, compras, gastos, nómina, inventario y cortesías registradas en el sistema.
            </div>
          </div>

          {/* Toggles */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--erp-border)" }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--erp-text-3)", marginBottom: 9 }}>
              Contexto activo para esta consulta
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {TOGGLE_OPTS.map((t) => {
                const on = toggles.includes(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => setToggles((prev) => on ? prev.filter((k) => k !== t.key) : [...prev, t.key])}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 12px", borderRadius: 99,
                      fontSize: 11, fontWeight: 600,
                      border: on ? `1.5px solid ${t.color}` : "1.5px solid var(--erp-border)",
                      color: on ? t.color : "var(--erp-text-2)",
                      background: on ? `${t.color}12` : "var(--erp-surface-2)",
                      cursor: "pointer",
                      boxShadow: on ? `0 0 10px ${t.color}20` : "none",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", opacity: on ? 1 : 0.4 }} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat */}
          <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* History */}
            {chat.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto" }}>
                {chat.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 9, alignItems: "flex-start",
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                    maxWidth: "90%", alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                      background: msg.role === "user" ? "rgba(88,166,255,.12)" : "var(--erp-surface-2)",
                      border: msg.role === "user" ? "1px solid rgba(88,166,255,.2)" : "1px solid var(--erp-border)",
                    }}>
                      {msg.role === "user" ? "👤" : "🤖"}
                    </div>
                    <div>
                      <div style={{
                        padding: "9px 13px", borderRadius: 10, fontSize: 12, lineHeight: 1.6,
                        background: msg.role === "user" ? "rgba(88,166,255,.1)" : "var(--erp-surface-2)",
                        border: msg.role === "user" ? "1px solid rgba(88,166,255,.2)" : "1px solid var(--erp-border)",
                        color: "var(--erp-text)",
                      }}>
                        {msg.role === "ia" ? renderIaText(msg.text) : msg.text}
                      </div>
                      <p style={{ fontSize: 10, color: "var(--erp-text-3)", margin: "3px 4px 0", textAlign: msg.role === "user" ? "right" : "left" }}>
                        {msg.role === "ia" ? "Asesor IA · " : ""}{msg.ts}
                      </p>
                    </div>
                  </div>
                ))}
                {asesorLoading && (
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: "var(--erp-surface-2)", border: "1px solid var(--erp-border)" }}>🤖</div>
                    <div style={{ padding: "9px 13px", borderRadius: 10, fontSize: 12, background: "var(--erp-surface-2)", border: "1px solid var(--erp-border)", color: "var(--erp-text-2)", fontStyle: "italic" }}>
                      Analizando…
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Suggested questions */}
            {chat.length === 0 && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)", marginBottom: 8 }}>
                  Preguntas sugeridas
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {[
                    "¿Cuál es el producto más rentable este mes?",
                    "¿En qué semana del mes vendemos más?",
                    "¿Cómo impacta la nómina en el margen por empleado?",
                    "¿Qué pasa con la caja si las ventas bajan 20%?",
                    "¿Cuánto representan las cortesías del total de egresos?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setPregunta(q); }}
                      style={{
                        padding: "5px 11px", borderRadius: 7, fontSize: 11,
                        color: "var(--erp-text-2)", border: "1px solid var(--erp-border)",
                        background: "var(--erp-surface-2)", cursor: "pointer", lineHeight: 1.3,
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div>
              <div style={{
                display: "flex", gap: 10, alignItems: "flex-end",
                background: "var(--erp-surface-2)",
                border: "1.5px solid #2F4A6B",
                borderRadius: 10, padding: "11px 13px",
              }}>
                <textarea
                  value={pregunta}
                  onChange={(e) => setPregunta(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAsesor(); } }}
                  placeholder="Consulta sobre ventas, márgenes, gastos o flujo de caja de tu empresa…"
                  rows={2}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none", resize: "none",
                    fontFamily: "inherit", fontSize: 13, color: "var(--erp-text)", lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={sendAsesor}
                  disabled={asesorLoading || !pregunta.trim()}
                  style={{
                    padding: "7px 16px", borderRadius: 7, border: "none",
                    background: "#58A6FF", color: "#0D1117",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    opacity: asesorLoading || !pregunta.trim() ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  Consultar →
                </button>
              </div>
              <p style={{ fontSize: 10, color: "var(--erp-text-3)", marginTop: 7, display: "flex", alignItems: "center", gap: 5 }}>
                🔒 El asesor solo accede a los datos de tu empresa. No responde preguntas fuera del ámbito financiero y operativo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

        /* ── Base grids ── */
        .af-kpi-strip  { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }
        .af-main-grid  { display: grid; grid-template-columns: 1fr 320px; gap: 16px; }
        .af-wf-row     { display: grid; grid-template-columns: 150px 1fr 90px 55px; align-items: center; gap: 10px; margin-bottom: 6px; }
        .af-pl-head    { display: grid; grid-template-columns: 1fr 100px 100px 100px 80px 80px; padding: 10px 18px; border-bottom: 1px solid var(--erp-border); background: var(--erp-surface-2); }
        .af-pl-row     { display: grid; grid-template-columns: 1fr 100px 100px 100px 80px 80px; padding: 8px 18px; align-items: center; }
        .af-anno-grid  { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-top: 16px; }
        .af-ia-grid    { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 16px; }

        /* ── Tablet ≤ 800px ── */
        @media (max-width: 800px) {
          .af-kpi-strip  { grid-template-columns: repeat(2,1fr); }
          .af-main-grid  { grid-template-columns: 1fr; }
          .af-ia-grid    { grid-template-columns: 1fr; }
          .af-anno-grid  { grid-template-columns: 1fr 1fr; }
          /* Hide Jul column + % Ing in P&L table on tablet */
          .af-pl-head > *:nth-child(3),
          .af-pl-row  > *:nth-child(3) { display: none; }
        }

        /* ── Mobile ≤ 540px ── */
        @media (max-width: 540px) {
          .af-kpi-strip  { grid-template-columns: 1fr 1fr; }
          .af-anno-grid  { grid-template-columns: 1fr; }
          .af-ia-grid    { grid-template-columns: 1fr; }

          /* Waterfall: label + amount only, hide bar + pct */
          .af-wf-row     { grid-template-columns: 1fr 80px; }
          .af-wf-row > *:nth-child(2) { display: none; }  /* bar */
          .af-wf-row > *:nth-child(4) { display: none; }  /* pct */

          /* P&L table: concept + current month + MoM only */
          .af-pl-head { grid-template-columns: 1fr 80px 70px; padding: 8px 12px; }
          .af-pl-row  { grid-template-columns: 1fr 80px 70px; padding: 7px 12px; }
          /* Hide Jun, Jul, % Ing columns (keep: concept[1], Ago[4], MoM[5]) */
          .af-pl-head > *:nth-child(2),
          .af-pl-head > *:nth-child(3),
          .af-pl-head > *:nth-child(6),
          .af-pl-row  > *:nth-child(2),
          .af-pl-row  > *:nth-child(3),
          .af-pl-row  > *:nth-child(6) { display: none; }
        }
      `}</style>
    </div>
  );
}

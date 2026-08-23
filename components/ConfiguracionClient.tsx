"use client";

import { useEffect, useState, FormEvent } from "react";

type Config = {
  nombre_empresa: string;
  imagen_retencion_dias: string;
  modo_entrega_default: string;
  wink_costo_default: string;
  cashea_porcentajes: string;
  cashea_porcentaje_default: string;
  cashea_dias: string;
  cashea_dias_default: string;
  yummy_dias: string;
  yummy_dias_default: string;
  ventas_modo_vista: string;
  ventas_orden_pasos: string;
  ventas_paso1_abierto: string;
  ventas_paso2_abierto: string;
  ventas_paso3_abierto: string;
  ventas_paso4_abierto: string;
  ventas_meta_total_hoy: string;
  nomina_auto_generar: string;
};

const SECTION_KEYS = ["general", "cashea", "yummy", "ventas", "nomina"] as const;
type SectionKey = typeof SECTION_KEYS[number];

function SectionToggle({
  id, title, icon, accent, open, onToggle, children,
}: {
  id: SectionKey;
  title: string;
  icon: string;
  accent?: { border: string; bg: string; dot: string };
  open: boolean;
  onToggle: (id: SectionKey) => void;
  children: React.ReactNode;
}) {
  const border = accent?.border ?? "var(--erp-border)";
  const bg = accent?.bg ?? "var(--erp-surface)";
  const dot = accent?.dot;

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.85rem 1rem",
          background: bg,
          border: "none",
          cursor: "pointer",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          {dot && (
            <span
              style={{
                display: "inline-flex",
                width: 22,
                height: 22,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: dot,
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          {!dot && <span style={{ fontSize: "1rem" }}>{icon}</span>}
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--erp-text)" }}>{title}</span>
        </div>
        <span style={{ fontSize: "1rem", color: "var(--erp-text-2)", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            padding: "1rem",
            borderTop: `1px solid ${border}`,
            background: "var(--erp-bg)",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const inputSt: React.CSSProperties = {
  padding: "0.4rem 0.65rem",
  border: "1px solid var(--erp-border)",
  borderRadius: "6px",
  background: "var(--erp-bg)",
  color: "var(--erp-text)",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

function TagList({
  items, onRemove, accentBorder,
}: { items: string[]; onRemove: (v: string) => void; accentBorder?: string }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.4rem" }}>
      {items.map((v) => (
        <span
          key={v}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.15rem 0.55rem",
            borderRadius: "20px",
            border: `1px solid ${accentBorder ?? "var(--erp-border)"}`,
            background: "var(--erp-bg)",
            fontSize: "0.78rem",
            fontWeight: 500,
            color: "var(--erp-text)",
          }}
        >
          {v}
          <button
            type="button"
            onClick={() => onRemove(v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#b91c1c", fontSize: "0.9rem", lineHeight: 1 }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export default function ConfiguracionClient() {
  const [config, setConfig] = useState<Config>({
    nombre_empresa: "",
    imagen_retencion_dias: "7",
    modo_entrega_default: "DELIVERY",
    wink_costo_default: "3",
    cashea_porcentajes: "40,50,60",
    cashea_porcentaje_default: "50",
    cashea_dias: "15,30",
    cashea_dias_default: "15",
    yummy_dias: "2,3,4,5",
    yummy_dias_default: "2",
    ventas_modo_vista: "clasico",
    ventas_orden_pasos: "entrega_primero",
    ventas_paso1_abierto: "true",
    ventas_paso2_abierto: "true",
    ventas_paso3_abierto: "true",
    ventas_paso4_abierto: "true",
    ventas_meta_total_hoy: "1",
    nomina_auto_generar: "false",
  });

  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    general: true,
    cashea: false,
    yummy: false,
    ventas: false,
    nomina: false,
  });

  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");
  const [nuevoDias, setNuevoDias] = useState("");
  const [nuevoYummyDias, setNuevoYummyDias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((d) => { setConfig((prev) => ({ ...prev, ...d })); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function toggleSection(id: SectionKey) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function expandAll() { setOpen({ general: true, cashea: true, yummy: true, ventas: true, nomina: true }); }
  function collapseAll() { setOpen({ general: false, cashea: false, yummy: false, ventas: false, nomina: false }); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      setMensaje("Configuración guardada");
      setTimeout(() => setMensaje(null), 3000);
    } catch {
      setMensaje("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const porcentajesArr = (config.cashea_porcentajes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const diasArr = (config.cashea_dias ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const yummyDiasArr = (config.yummy_dias ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  function addPorcentaje() {
    const val = nuevoPorcentaje.trim();
    if (!val || porcentajesArr.includes(val)) return;
    setConfig((p) => ({ ...p, cashea_porcentajes: [...porcentajesArr, val].join(",") }));
    setNuevoPorcentaje("");
  }
  function removePorcentaje(val: string) {
    const updated = porcentajesArr.filter((v) => v !== val);
    setConfig((p) => ({ ...p, cashea_porcentajes: updated.join(","), cashea_porcentaje_default: p.cashea_porcentaje_default === val ? (updated[0] ?? "") : p.cashea_porcentaje_default }));
  }
  function addDias() {
    const val = nuevoDias.trim();
    if (!val || diasArr.includes(val)) return;
    setConfig((p) => ({ ...p, cashea_dias: [...diasArr, val].join(",") }));
    setNuevoDias("");
  }
  function removeDias(val: string) {
    const updated = diasArr.filter((v) => v !== val);
    setConfig((p) => ({ ...p, cashea_dias: updated.join(","), cashea_dias_default: p.cashea_dias_default === val ? (updated[0] ?? "") : p.cashea_dias_default }));
  }
  function addYummyDias() {
    const val = nuevoYummyDias.trim();
    if (!val || yummyDiasArr.includes(val)) return;
    setConfig((p) => ({ ...p, yummy_dias: [...yummyDiasArr, val].join(",") }));
    setNuevoYummyDias("");
  }
  function removeYummyDias(val: string) {
    const updated = yummyDiasArr.filter((v) => v !== val);
    setConfig((p) => ({ ...p, yummy_dias: updated.join(","), yummy_dias_default: p.yummy_dias_default === val ? (updated[0] ?? "") : p.yummy_dias_default }));
  }

  if (loading) return <p style={{ fontSize: "0.875rem", color: "var(--erp-text-3)" }}>Cargando...</p>;

  const allOpen = SECTION_KEYS.every((k) => open[k]);

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 560 }}>
      {/* Expand / collapse all */}
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button type="button" onClick={allOpen ? collapseAll : expandAll} style={{ padding: "0.3rem 0.8rem", border: "1px solid var(--erp-border)", borderRadius: "6px", background: "transparent", color: "var(--erp-text-2)", fontSize: "0.78rem", cursor: "pointer" }}>
          {allOpen ? "Contraer todo" : "Expandir todo"}
        </button>
      </div>

      {/* General */}
      <SectionToggle id="general" title="General" icon="⚙️" open={open.general} onToggle={toggleSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Nombre de la Empresa</label>
          <p style={{ fontSize: "0.775rem", color: "var(--erp-text-3)", margin: "0 0 0.35rem 0" }}>
            Aparece en el encabezado de reportes compartidos por WhatsApp y en el reporte de inventario disponible.
          </p>
          <input
            type="text"
            style={{ ...inputSt, width: "100%", maxWidth: 320 }}
            value={config.nombre_empresa}
            onChange={(e) => setConfig({ ...config, nombre_empresa: e.target.value })}
            placeholder="Ej: Hechizo Gourmet"
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Modo de entrega por defecto</label>
          <p style={{ fontSize: "0.775rem", color: "var(--erp-text-3)", margin: "0 0 0.35rem 0" }}>Valor inicial al registrar una venta nueva.</p>
          <select style={{ ...inputSt, width: 160 }} value={config.modo_entrega_default} onChange={(e) => setConfig({ ...config, modo_entrega_default: e.target.value })}>
            <option value="DELIVERY">Delivery</option>
            <option value="LOCAL">Local</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Costo por defecto Wink ($)</label>
          <input type="number" step="0.01" min={0} style={{ ...inputSt, width: 100 }} value={config.wink_costo_default} onChange={(e) => setConfig({ ...config, wink_costo_default: e.target.value })} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Días de retención de imágenes</label>
          <p style={{ fontSize: "0.775rem", color: "var(--erp-text-3)", margin: "0 0 0.35rem 0" }}>Las imágenes del punto de venta se eliminan automáticamente después de este número de días.</p>
          <input type="number" min={1} max={90} style={{ ...inputSt, width: 100 }} value={config.imagen_retencion_dias} onChange={(e) => setConfig({ ...config, imagen_retencion_dias: e.target.value })} />
        </div>
      </SectionToggle>

      {/* Cashea */}
      <SectionToggle
        id="cashea" title="Cashea" icon="C"
        accent={{ border: "#fde68a", bg: "#fefce8", dot: "#f59e0b" }}
        open={open.cashea} onToggle={toggleSection}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>% de cuota inicial (opciones)</label>
          <TagList items={porcentajesArr.map((v) => `${v}%`)} onRemove={(v) => removePorcentaje(v.replace("%", ""))} accentBorder="#fde68a" />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input type="number" min={1} max={99} value={nuevoPorcentaje} onChange={(e) => setNuevoPorcentaje(e.target.value)} placeholder="Ej: 40" style={{ ...inputSt, width: 80 }} />
            <button type="button" onClick={addPorcentaje} style={{ padding: "0.35rem 0.8rem", border: "1px solid var(--erp-border)", borderRadius: "6px", background: "transparent", color: "var(--erp-text)", fontSize: "0.8rem", cursor: "pointer" }}>Agregar</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>% por defecto</label>
          <select style={{ ...inputSt, width: 110 }} value={config.cashea_porcentaje_default} onChange={(e) => setConfig({ ...config, cashea_porcentaje_default: e.target.value })}>
            {porcentajesArr.map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Días de financiamiento (opciones)</label>
          <TagList items={diasArr.map((v) => `${v} días`)} onRemove={(v) => removeDias(v.replace(" días", ""))} accentBorder="#fde68a" />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input type="number" min={1} value={nuevoDias} onChange={(e) => setNuevoDias(e.target.value)} placeholder="Ej: 45" style={{ ...inputSt, width: 80 }} />
            <button type="button" onClick={addDias} style={{ padding: "0.35rem 0.8rem", border: "1px solid var(--erp-border)", borderRadius: "6px", background: "transparent", color: "var(--erp-text)", fontSize: "0.8rem", cursor: "pointer" }}>Agregar</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Días por defecto</label>
          <select style={{ ...inputSt, width: 110 }} value={config.cashea_dias_default} onChange={(e) => setConfig({ ...config, cashea_dias_default: e.target.value })}>
            {diasArr.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </SectionToggle>

      {/* Yummy */}
      <SectionToggle
        id="yummy" title="Yummy — Cuentas por Cobrar" icon="Y"
        accent={{ border: "#86efac", bg: "#f0fdf4", dot: "#16a34a" }}
        open={open.yummy} onToggle={toggleSection}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Días de pago (opciones)</label>
          <TagList items={yummyDiasArr.map((v) => `${v} días`)} onRemove={(v) => removeYummyDias(v.replace(" días", ""))} accentBorder="#86efac" />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input type="number" min={1} value={nuevoYummyDias} onChange={(e) => setNuevoYummyDias(e.target.value)} placeholder="Ej: 7" style={{ ...inputSt, width: 80 }} />
            <button type="button" onClick={addYummyDias} style={{ padding: "0.35rem 0.8rem", border: "1px solid var(--erp-border)", borderRadius: "6px", background: "transparent", color: "var(--erp-text)", fontSize: "0.8rem", cursor: "pointer" }}>Agregar</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Días por defecto</label>
          <select style={{ ...inputSt, width: 110 }} value={config.yummy_dias_default} onChange={(e) => setConfig({ ...config, yummy_dias_default: e.target.value })}>
            {yummyDiasArr.map((v) => <option key={v} value={v}>{v} días</option>)}
          </select>
        </div>
      </SectionToggle>

      {/* Ventas */}
      <SectionToggle id="ventas" title="Formulario de Ventas" icon="🛒" open={open.ventas} onToggle={toggleSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Modo de vista</label>
          <p style={{ fontSize: "0.775rem", color: "var(--erp-text-3)", margin: "0 0 0.35rem 0" }}>
            "Clásico" muestra todo expandido. "Pasos" divide el formulario en 4 secciones colapsables.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {[{ val: "clasico", label: "Clásico" }, { val: "pasos", label: "Pasos" }].map(({ val, label }) => (
              <button
                key={val} type="button"
                onClick={() => setConfig({ ...config, ventas_modo_vista: val })}
                style={{
                  padding: "0.35rem 0.85rem", borderRadius: "6px", fontSize: "0.85rem", fontWeight: 500, cursor: "pointer",
                  border: `1px solid ${config.ventas_modo_vista === val ? "var(--erp-primary)" : "var(--erp-border)"}`,
                  background: config.ventas_modo_vista === val ? "var(--erp-primary)" : "transparent",
                  color: config.ventas_modo_vista === val ? "#fff" : "var(--erp-text)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Orden de pasos (default global)</label>
          <p style={{ fontSize: "0.775rem", color: "var(--erp-text-3)", margin: "0 0 0.35rem 0" }}>Cada usuario puede cambiarlo en su perfil.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {[
              { val: "default", label: "1 Productos · 2 Formas de pago · 3 Entrega · 4 Cliente" },
              { val: "entrega_primero", label: "1 Productos · 2 Entrega · 3 Formas de pago · 4 Cliente" },
              { val: "cliente_primero", label: "1 Cliente · 2 Productos · 3 Entrega · 4 Formas de pago" },
            ].map(({ val, label }) => (
              <button
                key={val} type="button"
                onClick={() => setConfig({ ...config, ventas_orden_pasos: val })}
                style={{
                  padding: "0.4rem 0.85rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer", textAlign: "left",
                  border: `1px solid ${config.ventas_orden_pasos === val ? "var(--erp-primary)" : "var(--erp-border)"}`,
                  background: config.ventas_orden_pasos === val ? "var(--erp-primary)" : "transparent",
                  color: config.ventas_orden_pasos === val ? "#fff" : "var(--erp-text)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--erp-text-3)", margin: "0.35rem 0 0 0" }}>Esta opción será el default hasta que cada usuario defina su propia secuencia en su perfil.</p>
        </div>

        {config.ventas_modo_vista === "pasos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Secciones abiertas por defecto (escritorio)</label>
            {[
              { key: "ventas_paso1_abierto", label: "1 — Productos del Pedido" },
              { key: "ventas_paso2_abierto", label: "2 — Formas de pago / Entrega" },
              { key: "ventas_paso3_abierto", label: "3 — Entrega / Formas de pago" },
              { key: "ventas_paso4_abierto", label: "4 — Datos del Cliente" },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.825rem", color: "var(--erp-text)" }}>{label}</span>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  {[{ val: "true", label: "Abierto" }, { val: "false", label: "Cerrado" }].map(({ val, label: lbl }) => (
                    <button
                      key={val} type="button"
                      onClick={() => setConfig({ ...config, [key]: val })}
                      style={{
                        padding: "0.2rem 0.65rem", borderRadius: "5px", fontSize: "0.775rem", fontWeight: 500, cursor: "pointer",
                        border: `1px solid ${config[key as keyof Config] === val ? "var(--erp-primary)" : "var(--erp-border)"}`,
                        background: config[key as keyof Config] === val ? "var(--erp-primary)" : "transparent",
                        color: config[key as keyof Config] === val ? "#fff" : "var(--erp-text)",
                      }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <label style={{ fontSize: "0.825rem", fontWeight: 500, color: "var(--erp-text-2)" }}>Meta Total Hoy (verde cuando supera)</label>
          <p style={{ fontSize: "0.775rem", color: "var(--erp-text-3)", margin: "0 0 0.35rem 0" }}>
            El indicador "Total Hoy" se muestra en verde cuando Venta Hoy + Ingresos supera este monto (en USD).
          </p>
          <input
            type="number"
            min="0"
            step="0.01"
            value={config.ventas_meta_total_hoy}
            onChange={(e) => setConfig({ ...config, ventas_meta_total_hoy: e.target.value })}
            style={{
              width: "140px",
              padding: "0.35rem 0.65rem",
              borderRadius: "6px",
              border: "1px solid var(--erp-border)",
              background: "var(--erp-bg)",
              color: "var(--erp-text)",
              fontSize: "0.875rem",
            }}
          />
        </div>
      </SectionToggle>

      {/* Nómina */}
      <SectionToggle id="nomina" title="Nómina" icon="💳" open={open.nomina} onToggle={toggleSection}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--erp-text)" }}>Generación automática de períodos</div>
              <div style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", marginTop: "0.2rem", maxWidth: 380 }}>
                El cron diario (10:00 UTC) revisa las nóminas en modo <strong>Automático</strong> y genera el período
                correspondiente si ya venció. Si está desactivado, los períodos deben generarse manualmente desde
                Configuración → Nóminas.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.nomina_auto_generar === "true"}
              onClick={() => setConfig({ ...config, nomina_auto_generar: config.nomina_auto_generar === "true" ? "false" : "true" })}
              style={{
                flexShrink: 0,
                width: 48,
                height: 26,
                borderRadius: 13,
                border: "none",
                cursor: "pointer",
                background: config.nomina_auto_generar === "true" ? "#16a34a" : "#d1d5db",
                position: "relative",
                transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute",
                top: 3,
                left: config.nomina_auto_generar === "true" ? 25 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
                display: "block",
              }} />
            </button>
          </div>
          <div style={{ fontSize: "0.78rem", padding: "0.5rem 0.75rem", borderRadius: 7, background: config.nomina_auto_generar === "true" ? "#f0fdf4" : "#fef9c3", color: config.nomina_auto_generar === "true" ? "#15803d" : "#a16207", border: `1px solid ${config.nomina_auto_generar === "true" ? "#86efac" : "#fde68a"}` }}>
            {config.nomina_auto_generar === "true"
              ? "✓ Activado — el cron generará períodos automáticamente cada día."
              : "⚠ Desactivado — los períodos deben generarse manualmente."}
          </div>
        </div>
      </SectionToggle>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: "0.45rem 1.25rem", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: "7px", fontSize: "0.875rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {mensaje && (
          <span style={{ fontSize: "0.85rem", color: mensaje.startsWith("Error") ? "#b91c1c" : "#16a34a" }}>{mensaje}</span>
        )}
      </div>
    </form>
  );
}

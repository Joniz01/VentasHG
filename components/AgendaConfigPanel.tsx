"use client";

import { useEffect, useState } from "react";

type AgendaCfg = {
  agenda_habilitada: string;
  agenda_alertas_pantalla: string;
  agenda_alertas_sonido: string;
  agenda_alerta_preparacion: string;
  agenda_alerta_retiro: string;
  agenda_mins_preparacion: string;
  agenda_mins_retiro: string;
  agenda_repetir_mins: string;
  agenda_dias_anticipacion: string;
};

const DEFAULTS: AgendaCfg = {
  agenda_habilitada: "false",
  agenda_alertas_pantalla: "true",
  agenda_alertas_sonido: "true",
  agenda_alerta_preparacion: "true",
  agenda_alerta_retiro: "true",
  agenda_mins_preparacion: "45",
  agenda_mins_retiro: "15",
  agenda_repetir_mins: "10",
  agenda_dias_anticipacion: "1",
};

export default function AgendaConfigPanel() {
  const [cfg, setCfg] = useState<AgendaCfg>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setCfg({
          agenda_habilitada:       data.agenda_habilitada       ?? "false",
          agenda_alertas_pantalla: data.agenda_alertas_pantalla ?? "true",
          agenda_alertas_sonido:   data.agenda_alertas_sonido   ?? "true",
          agenda_alerta_preparacion: data.agenda_alerta_preparacion ?? "true",
          agenda_alerta_retiro:    data.agenda_alerta_retiro    ?? "true",
          agenda_mins_preparacion: data.agenda_mins_preparacion ?? "45",
          agenda_mins_retiro:      data.agenda_mins_retiro      ?? "15",
          agenda_repetir_mins:     data.agenda_repetir_mins     ?? "10",
          agenda_dias_anticipacion: data.agenda_dias_anticipacion ?? "1",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function set(key: keyof AgendaCfg, value: string) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  function toggle(key: keyof AgendaCfg) {
    setCfg((prev) => ({ ...prev, [key]: prev[key] === "true" ? "false" : "true" }));
  }

  async function guardar() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <p style={{ fontSize: 14, color: "var(--erp-text-2)" }}>Cargando…</p>;

  const habilitada = cfg.agenda_habilitada === "true";

  const s: React.CSSProperties = {
    display: "flex", flexDirection: "column", gap: 24, maxWidth: 520,
  };
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: "var(--erp-surface, #fff)",
    border: "1px solid var(--erp-border, #e5e7eb)",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    ...extra,
  });
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 10, borderBottom: "1px solid var(--erp-border, #e5e7eb)",
  };
  const lastRow: React.CSSProperties = { ...rowStyle, borderBottom: "none", paddingBottom: 0 };

  return (
    <div style={s}>
      {/* Master toggle */}
      <div style={{ ...card({ borderColor: habilitada ? "var(--erp-accent, #f59e0b)" : undefined, background: habilitada ? "rgba(245,158,11,.05)" : undefined }) }}>
        <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          📅 Módulo Agenda de Pedidos
        </div>
        <div style={lastRow}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Habilitar Agenda de Pedidos</div>
            <div style={{ fontSize: 11, color: "var(--erp-text-2)", marginTop: 2 }}>
              {habilitada
                ? "Activo — el botón 📅 Agenda y el tab Agenda están visibles en Caja Rápida."
                : "Desactivado — el botón 📅 Agenda y el tab Agenda están ocultos en Caja Rápida."}
            </div>
          </div>
          <Toggle on={habilitada} onClick={() => toggle("agenda_habilitada")} />
        </div>
      </div>

      {/* Sub-config */}
      <div style={{ opacity: habilitada ? 1 : 0.4, pointerEvents: habilitada ? "auto" : "none", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card()}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: ".08em" }}>🔔 Alertas</div>
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Alertas en pantalla</div>
              <div style={{ fontSize: 11, color: "var(--erp-text-2)" }}>Popup animado en Caja Rápida al vencer el recordatorio</div>
            </div>
            <Toggle on={cfg.agenda_alertas_pantalla === "true"} onClick={() => toggle("agenda_alertas_pantalla")} />
          </div>
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Sonido de alerta</div>
              <div style={{ fontSize: 11, color: "var(--erp-text-2)" }}>Emite un beep al dispararse el recordatorio</div>
            </div>
            <Toggle on={cfg.agenda_alertas_sonido === "true"} onClick={() => toggle("agenda_alertas_sonido")} />
          </div>
          <div style={rowStyle}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Alerta de preparación</div>
              <div style={{ fontSize: 11, color: "var(--erp-text-2)" }}>Avisa a cocina X minutos antes de la entrega</div>
            </div>
            <Toggle on={cfg.agenda_alerta_preparacion === "true"} onClick={() => toggle("agenda_alerta_preparacion")} />
          </div>
          <div style={lastRow}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Alerta de retiro motorizado</div>
              <div style={{ fontSize: 11, color: "var(--erp-text-2)" }}>Avisa al motorizado X minutos antes para que esté listo</div>
            </div>
            <Toggle on={cfg.agenda_alerta_retiro === "true"} onClick={() => toggle("agenda_alerta_retiro")} />
          </div>
        </div>

        <div style={card()}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: ".08em" }}>⏱️ Tiempos por defecto</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SelectField label="🍳 Avisar preparar" value={cfg.agenda_mins_preparacion}
              onChange={(v) => set("agenda_mins_preparacion", v)}
              options={[["30","30 min"],["45","45 min"],["60","60 min"],["90","90 min"]]} />
            <SelectField label="🛵 Avisar retiro" value={cfg.agenda_mins_retiro}
              onChange={(v) => set("agenda_mins_retiro", v)}
              options={[["10","10 min"],["15","15 min"],["20","20 min"],["30","30 min"]]} />
            <SelectField label="🔁 Repetir alerta" value={cfg.agenda_repetir_mins}
              onChange={(v) => set("agenda_repetir_mins", v)}
              options={[["5","5 min"],["10","10 min"],["15","15 min"],["0","No repetir"]]} />
            <SelectField label="📅 Días a mostrar" value={cfg.agenda_dias_anticipacion}
              onChange={(v) => set("agenda_dias_anticipacion", v)}
              options={[["0","Solo hoy"],["1","1 día"],["2","2 días"],["7","Toda la semana"]]} />
          </div>
        </div>
      </div>

      <button
        onClick={guardar}
        disabled={saving}
        style={{ alignSelf: "flex-start", padding: "8px 20px", background: "var(--erp-accent, #f59e0b)", color: "#000", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar cambios"}
      </button>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: on ? "var(--erp-accent, #f59e0b)" : "var(--erp-border, #d1d5db)",
        position: "relative", flexShrink: 0, transition: "background .2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16,
        borderRadius: "50%", background: "#fff", transition: "left .2s",
      }} />
    </button>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, color: "var(--erp-text-2)" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "5px 8px", border: "1px solid var(--erp-border, #d1d5db)", borderRadius: 6, fontSize: 12, background: "var(--erp-bg, #f9fafb)", color: "var(--erp-text)" }}
      >
        {options.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
      </select>
    </div>
  );
}

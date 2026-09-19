"use client";

import { useEffect, useState } from "react";

type Config = {
  ventas_modo_vista: string;
  ventas_paso1_abierto: string;
  ventas_paso2_abierto: string;
  ventas_paso3_abierto: string;
  ventas_paso4_abierto: string;
};

const DEFAULTS: Config = {
  ventas_modo_vista: "pasos",
  ventas_paso1_abierto: "true",
  ventas_paso2_abierto: "true",
  ventas_paso3_abierto: "true",
  ventas_paso4_abierto: "true",
};

const PASOS = [
  { key: "ventas_paso1_abierto", label: "Paso 1 · Cliente y entrega" },
  { key: "ventas_paso2_abierto", label: "Paso 2 · Productos" },
  { key: "ventas_paso3_abierto", label: "Paso 3 · Pago" },
  { key: "ventas_paso4_abierto", label: "Paso 4 · Confirmación" },
] as const;

export default function PdVConfigClient() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setCfg({
          ventas_modo_vista: data.ventas_modo_vista ?? "pasos",
          ventas_paso1_abierto: data.ventas_paso1_abierto ?? "true",
          ventas_paso2_abierto: data.ventas_paso2_abierto ?? "true",
          ventas_paso3_abierto: data.ventas_paso3_abierto ?? "true",
          ventas_paso4_abierto: data.ventas_paso4_abierto ?? "true",
        });
      })
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Modo vista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>
          Modo vista por defecto
        </label>
        <p style={{ fontSize: 12, color: "var(--erp-text-2)", margin: 0 }}>
          Los usuarios pueden anular este valor desde su perfil. Aplica a usuarios sin preferencia configurada.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {[
            { value: "clasico", label: "Clásico", desc: "Todo expandido en una pantalla" },
            { value: "pasos",   label: "Por Pasos", desc: "Secciones colapsables (wizard)" },
          ].map((op) => (
            <button
              key={op.value}
              type="button"
              onClick={() => setCfg((c) => ({ ...c, ventas_modo_vista: op.value }))}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: cfg.ventas_modo_vista === op.value
                  ? "2px solid var(--erp-primary)"
                  : "1px solid var(--erp-border)",
                background: cfg.ventas_modo_vista === op.value
                  ? "var(--erp-primary-soft, #fef9ec)"
                  : "var(--erp-surface)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>{op.label}</div>
              <div style={{ fontSize: 11, color: "var(--erp-text-2)", marginTop: 2 }}>{op.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Pasos abiertos por defecto */}
      {cfg.ventas_modo_vista === "pasos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>
            Pasos abiertos por defecto
          </label>
          <p style={{ fontSize: 12, color: "var(--erp-text-2)", margin: 0 }}>
            En modo Por Pasos, indica cuáles secciones aparecen expandidas al abrir una venta nueva.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {PASOS.map((paso) => (
              <label
                key={paso.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "var(--erp-text)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={cfg[paso.key] !== "false"}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, [paso.key]: e.target.checked ? "true" : "false" }))
                  }
                />
                {paso.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          style={{
            padding: "8px 20px",
            borderRadius: 7,
            border: "none",
            background: "var(--erp-primary)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {saved && (
          <span style={{ fontSize: 12, color: "var(--erp-success, #16a34a)" }}>
            ✓ Guardado
          </span>
        )}
      </div>
    </div>
  );
}

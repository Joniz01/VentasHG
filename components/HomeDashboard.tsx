"use client";

import { useEffect, useState } from "react";

type Metricas = {
  ordenes: number;
  totalUsd: number;
  ticket: number;
  utilidad: number;
  ayer: { ordenes: number; totalUsd: number; ticket: number };
};

function delta(hoy: number, ayer: number): { pct: number; up: boolean } | null {
  if (ayer === 0) return null;
  const pct = ((hoy - ayer) / ayer) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DeltaBadge({ hoy, ayer, suffix = "" }: { hoy: number; ayer: number; suffix?: string }) {
  const d = delta(hoy, ayer);
  if (!d) return null;
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600,
        color: d.up ? "var(--erp-success, #16a34a)" : "#dc2626",
        display: "inline-flex", alignItems: "center", gap: 2,
      }}
    >
      {d.up ? "↑" : "↓"} {d.pct.toFixed(0)}%{suffix}
      <span style={{ fontWeight: 400, color: "var(--erp-text-3)", fontSize: 10 }}>
        vs ayer
      </span>
    </span>
  );
}

export default function HomeDashboard() {
  const [data, setData] = useState<Metricas | null>(null);

  useEffect(() => {
    fetch("/api/home/metricas")
      .then((r) => r.json())
      .then((d: Metricas) => setData(d))
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
          marginBottom: 20,
        }}
      >
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--erp-surface)", border: "1px solid var(--erp-border)",
              borderRadius: 10, padding: "12px 14px", minHeight: 80,
              opacity: .5,
            }}
          />
        ))}
      </div>
    );
  }

  const tiles = [
    {
      label: "Facturación hoy",
      icon: "💵",
      value: fmt(data.totalUsd),
      delta: <DeltaBadge hoy={data.totalUsd} ayer={data.ayer.totalUsd} />,
    },
    {
      label: "Ticket promedio",
      icon: "🎫",
      value: fmt(data.ticket),
      delta: <DeltaBadge hoy={data.ticket} ayer={data.ayer.ticket} />,
    },
    {
      label: "Órdenes hoy",
      icon: "🛍️",
      value: String(data.ordenes),
      delta: <DeltaBadge hoy={data.ordenes} ayer={data.ayer.ordenes} />,
    },
    {
      label: "Utilidad bruta",
      icon: "📈",
      value: fmt(data.utilidad),
      delta: null,
    },
  ];

  return (
    <div
      style={{
        display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10,
        marginBottom: 20,
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            background: "var(--erp-surface)",
            border: "1px solid var(--erp-border)",
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: 11, fontWeight: 500, color: "var(--erp-text-3)",
              display: "flex", alignItems: "center", gap: 6, marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 14, opacity: .8 }}>{t.icon}</span>
            {t.label}
          </div>
          <div
            style={{
              fontSize: 22, fontWeight: 700, color: "var(--erp-text)",
              fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em",
              marginBottom: 4,
            }}
          >
            {t.value}
          </div>
          {t.delta}
        </div>
      ))}
    </div>
  );
}

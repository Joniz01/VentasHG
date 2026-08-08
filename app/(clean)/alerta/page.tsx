"use client";

import { useEffect, useState } from "react";

const VELOCIDADES: Record<string, number> = { lento: 900, normal: 500, rapido: 250 };

export default function AlertaPage() {
  const [params, setParams] = useState<Record<string, string>>({});
  const [flashOn, setFlashOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const p: Record<string, string> = {};
    for (const [k, v] of sp.entries()) p[k] = v;
    setParams(p);
    setReady(true);
  }, []);

  const colorA = params.colorA ?? "#dc2626";
  const colorB = params.colorB ?? "#ea580c";
  const velocidad = params.velocidad ?? "normal";

  useEffect(() => {
    if (!ready) return;
    const ms = VELOCIDADES[velocidad] ?? 500;
    const iv = setInterval(() => setFlashOn((v) => !v), ms);
    return () => clearInterval(iv);
  }, [ready, velocidad]);

  useEffect(() => {
    if (!ready || !params.etapa) return;
    const msgs = [`🚨 ${params.etapa?.toUpperCase()} — #${params.id}`, "⚠️ VER ALERTA"];
    let i = 0;
    const iv = setInterval(() => { document.title = msgs[i++ % 2]; }, 800);
    return () => clearInterval(iv);
  }, [ready, params.etapa, params.id]);

  if (!ready) return null;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: flashOn ? colorA : colorB,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 10 }}>{params.emoji ?? "🚨"}</div>
        <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 8, textTransform: "uppercase" }}>
          {params.etapa}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
          Pedido #{params.id} — {params.cliente}
        </div>
        {params.hora && params.hora !== "-" && (
          <div style={{ fontSize: 15, opacity: 0.9, marginBottom: 8 }}>
            🕐 Entrega: {params.hora}
          </div>
        )}
        <div style={{ fontSize: 13, opacity: 0.85, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
          {params.productos}
        </div>
      </div>
      <button
        onClick={() => window.close()}
        style={{
          background: "#fff",
          color: colorA,
          border: "none",
          borderRadius: 12,
          padding: "16px 44px",
          fontSize: 18,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        ✓ Entendido
      </button>
    </div>
  );
}

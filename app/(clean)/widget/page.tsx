"use client";

import { useEffect, useRef, useState } from "react";
import { computeEstadoPedido, ESTADO_PEDIDO_LABELS, formatHora } from "@/lib/pedidos";
import type { PedidoPendiente } from "@/lib/types";

type Size = "s" | "m" | "l";

const ESTADO_COLORS: Record<string, { bg: string; border: string; chip: string; text: string }> = {
  PENDIENTE: { bg: "#1c1c1e", border: "#3f3f46",  chip: "#3f3f46",  text: "#a1a1aa" },
  PREPARAR:  { bg: "#1c1408", border: "#a16207",  chip: "#ca8a04",  text: "#fef9c3" },
  RETIRO:    { bg: "#0b1929", border: "#1d4ed8",  chip: "#2563eb",  text: "#bfdbfe" },
  ENTREGAR:  { bg: "#0a1f0e", border: "#15803d",  chip: "#16a34a",  text: "#bbf7d0" },
};

const ESTADO_EMOJI: Record<string, string> = {
  PENDIENTE: "⏳", PREPARAR: "⏰", RETIRO: "🚗", ENTREGAR: "🏠",
};

// Priority order: ENTREGAR > RETIRO > PREPARAR
const ESTADO_PRIORITY: Record<string, number> = { ENTREGAR: 3, RETIRO: 2, PREPARAR: 1 };
const FLASH_COLORS: Record<string, [string, string]> = {
  PREPARAR: ["#a16207", "#1c1408"],
  RETIRO:   ["#1d4ed8", "#0b1929"],
  ENTREGAR: ["#15803d", "#0a1f0e"],
};

function getActionEstado(pedidos: PedidoPendiente[], now: number): string | null {
  let best: string | null = null;
  for (const p of pedidos) {
    if (p.pedidoEntregado) continue;
    const e = computeEstadoPedido(now, p.horaPreparacion, p.horaRetiro, p.horaEntrega);
    if ((ESTADO_PRIORITY[e] ?? 0) > (ESTADO_PRIORITY[best ?? ""] ?? 0)) best = e;
  }
  return best && ESTADO_PRIORITY[best] ? best : null;
}

export default function WidgetPage() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [now, setNow] = useState(Date.now());
  const nowRef = useRef(Date.now());
  const [size, setSize] = useState<Size>("m");
  const [flashOn, setFlashOn] = useState(false);

  // Each (pedidoId-estado) pair tracks its own acknowledgment
  const [acknowledgedSet, setAcknowledgedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("size");
    if (s === "s" || s === "m" || s === "l") setSize(s as Size);
  }, []);

  async function loadPedidos() {
    try {
      const res = await fetch("/api/pedidos-pendientes");
      if (res.ok) setPedidos(await res.json());
    } catch {}
  }

  useEffect(() => {
    loadPedidos();
    const iv = setInterval(loadPedidos, 15_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => { const t = Date.now(); nowRef.current = t; setNow(t); }, 1000);
    return () => clearInterval(iv);
  }, []);

  const pendientes = pedidos.filter((p) => !p.pedidoEntregado).slice(0, 2);

  // Compute which pedidos have unacknowledged alerts
  const unacknowledged = pendientes.filter((p) => {
    const e = computeEstadoPedido(now, p.horaPreparacion, p.horaRetiro, p.horaEntrega);
    return ESTADO_PRIORITY[e] && !acknowledgedSet.has(`${p.id}-${e}`);
  });

  const hasAlert = unacknowledged.length > 0;
  const topEstado = getActionEstado(unacknowledged, now);

  function acknowledgeAll() {
    const t = nowRef.current;
    setAcknowledgedSet((prev) => {
      const next = new Set(prev);
      for (const p of pendientes) {
        const e = computeEstadoPedido(t, p.horaPreparacion, p.horaRetiro, p.horaEntrega);
        if (ESTADO_PRIORITY[e]) next.add(`${p.id}-${e}`);
      }
      return next;
    });
  }

  // Flash when unacknowledged alert
  useEffect(() => {
    if (!hasAlert) { setFlashOn(false); return; }
    const iv = setInterval(() => setFlashOn((v) => !v), 450);
    return () => clearInterval(iv);
  }, [hasAlert]);

  // Repeatedly try to bring window to front while unacknowledged
  useEffect(() => {
    if (!hasAlert) return;
    window.focus();
    const iv = setInterval(() => window.focus(), 2500);
    return () => clearInterval(iv);
  }, [hasAlert]);

  // Title flash
  useEffect(() => {
    if (!hasAlert) { document.title = "Widget — HG"; return; }
    const msgs = ["🚨 ACCIÓN REQUERIDA", "Widget — HG"];
    let i = 0;
    const iv = setInterval(() => { document.title = msgs[i++ % 2]; }, 700);
    return () => { clearInterval(iv); document.title = "Widget — HG"; };
  }, [hasAlert]);

  const isS = size === "s";
  const isL = size === "l";

  const flashColors = topEstado ? FLASH_COLORS[topEstado] : null;
  const bg = hasAlert && flashColors
    ? (flashOn ? flashColors[0] : flashColors[1])
    : "#18181b";

  return (
    <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden", transition: "background 0.08s" }}>

      {/* Header */}
      <div style={{ padding: isS ? "4px 8px 3px" : "6px 10px 5px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: isS ? 10 : 12, opacity: 0.85 }}>
          🍳 HG Comandera
        </span>
        <span style={{ color: hasAlert ? "#fbbf24" : "rgba(255,255,255,0.4)", fontSize: isS ? 10 : 11, fontWeight: 600 }}>
          {hasAlert ? `⚠ ${unacknowledged.length} alerta${unacknowledged.length !== 1 ? "s" : ""}` : pendientes.length > 0 ? `${pendientes.length} pendiente${pendientes.length !== 1 ? "s" : ""}` : "✓ Al día"}
        </span>
      </div>

      {/* Pedido rows */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: isS ? 2 : 4, padding: isS ? "4px 6px 4px" : isL ? "8px 10px 6px" : "6px 8px 4px", overflowY: "hidden" }}>
        {pendientes.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: isS ? 10 : 12, textAlign: "center", paddingTop: isS ? 4 : 10, fontStyle: "italic" }}>
            Sin pedidos pendientes
          </div>
        ) : (
          pendientes.map((p) => {
            const estado = computeEstadoPedido(now, p.horaPreparacion, p.horaRetiro, p.horaEntrega);
            const c = ESTADO_COLORS[estado] ?? ESTADO_COLORS.PENDIENTE;
            const isUnacked = ESTADO_PRIORITY[estado] && !acknowledgedSet.has(`${p.id}-${estado}`);
            const nombreCorto = isS ? p.cliente.split(" ").slice(0, 2).join(" ") : p.cliente;

            return (
              <div key={p.id} style={{
                background: isUnacked ? c.bg : c.bg + "99",
                border: `${isUnacked ? "2px" : "1.5px"} solid ${c.border}${isUnacked ? "" : "88"}`,
                borderRadius: isS ? 5 : 7,
                padding: isS ? "4px 8px" : isL ? "10px 12px" : "7px 10px",
                display: "flex",
                flexDirection: isL ? "column" : "row",
                alignItems: isL ? "stretch" : "center",
                justifyContent: "space-between",
                gap: isL ? 5 : 4,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: isS ? 5 : 7, minWidth: 0 }}>
                  <span style={{ fontSize: isS ? 12 : isL ? 16 : 14, flexShrink: 0 }}>{ESTADO_EMOJI[estado]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ color: c.text, fontWeight: 800, fontSize: isS ? 11 : isL ? 15 : 13, whiteSpace: "nowrap" }}>#{p.id}</span>
                      <span style={{ color: c.text, fontWeight: 500, fontSize: isS ? 11 : isL ? 14 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreCorto}</span>
                    </div>
                    {!isS && (
                      <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, marginTop: 1 }}>
                        {isL
                          ? p.items.map((i) => `${i.nombreProducto}${i.extraNombre ? ` (${i.extraNombre})` : ""} x${i.cantidad}`).join(", ")
                          : formatHora(p.horaEntrega)}
                      </div>
                    )}
                    {isL && (
                      <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, marginTop: 2 }}>🕐 {formatHora(p.horaEntrega)}</div>
                    )}
                  </div>
                </div>
                <span style={{ background: c.chip, color: c.text, borderRadius: 4, padding: isS ? "1px 5px" : "3px 8px", fontSize: isS ? 9 : 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {ESTADO_PEDIDO_LABELS[estado]}
                </span>
              </div>
            );
          })
        )}

        {pedidos.filter((p) => !p.pedidoEntregado).length > 2 && (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, textAlign: "center" }}>
            +{pedidos.filter((p) => !p.pedidoEntregado).length - 2} más
          </div>
        )}
      </div>

      {/* OK button — only shown when there are unacknowledged alerts */}
      {hasAlert && (
        <div style={{ padding: isS ? "3px 6px 5px" : "4px 8px 7px", flexShrink: 0 }}>
          <button
            onClick={acknowledgeAll}
            style={{
              width: "100%",
              padding: isS ? "5px 0" : "8px 0",
              background: flashOn ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
              color: flashColors ? flashColors[0] : "#18181b",
              border: "none",
              borderRadius: isS ? 5 : 7,
              fontWeight: 900,
              fontSize: isS ? 11 : 13,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              transition: "background 0.1s",
            }}
          >
            ✓ OK — Visto
          </button>
        </div>
      )}
    </div>
  );
}

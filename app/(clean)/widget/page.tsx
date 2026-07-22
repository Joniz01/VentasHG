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
  PENDIENTE: "⏳",
  PREPARAR:  "⏰",
  RETIRO:    "🚗",
  ENTREGAR:  "🏠",
};

const FLASH_COLORS: Record<string, string> = {
  PREPARAR: "#a16207",
  RETIRO:   "#1d4ed8",
  ENTREGAR: "#15803d",
};

export default function WidgetPage() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [now, setNow] = useState(Date.now());
  const [size, setSize] = useState<Size>("m");
  const [flashOn, setFlashOn] = useState(false);
  const prevActionRef = useRef(false);

  // Read size from URL param
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("size");
    if (s === "s" || s === "m" || s === "l") setSize(s);
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
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const pendientes = pedidos.filter((p) => !p.pedidoEntregado).slice(0, 2);

  const actionEstado = pendientes.reduce<string | null>((acc, p) => {
    if (acc === "ENTREGAR") return acc;
    const e = computeEstadoPedido(now, p.horaPreparacion, p.horaRetiro, p.horaEntrega);
    if (e === "ENTREGAR") return "ENTREGAR";
    if (e === "RETIRO" && acc !== "ENTREGAR") return "RETIRO";
    if (e === "PREPARAR" && !acc) return "PREPARAR";
    return acc;
  }, null);

  // Flash when action needed
  useEffect(() => {
    if (!actionEstado) { setFlashOn(false); return; }
    const iv = setInterval(() => setFlashOn((v) => !v), 500);
    return () => clearInterval(iv);
  }, [actionEstado]);

  // Focus window when new alert fires
  useEffect(() => {
    const hadAction = prevActionRef.current;
    prevActionRef.current = !!actionEstado;
    if (actionEstado && !hadAction) window.focus();
  }, [actionEstado]);

  // Title flash
  useEffect(() => {
    if (!actionEstado) { document.title = "Widget — HG"; return; }
    const msgs = ["🚨 ACCIÓN REQUERIDA", "Widget — HG"];
    let i = 0;
    const iv = setInterval(() => { document.title = msgs[i++ % 2]; }, 800);
    return () => { clearInterval(iv); document.title = "Widget — HG"; };
  }, [actionEstado]);

  const flashColor = actionEstado ? (flashOn ? FLASH_COLORS[actionEstado] : "#18181b") : "#18181b";
  const isS = size === "s";
  const isL = size === "l";

  return (
    <div style={{
      minHeight: "100dvh",
      background: flashColor,
      display: "flex",
      flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
      overflow: "hidden",
      transition: "background 0.1s",
      userSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        padding: isS ? "4px 8px 3px" : "6px 10px 5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: isS ? 10 : 12, letterSpacing: "0.03em", opacity: 0.9 }}>
          🍳 HG Comandera
        </span>
        <span style={{
          color: pendientes.length > 0 ? "#fbbf24" : "rgba(255,255,255,0.4)",
          fontSize: isS ? 10 : 11,
          fontWeight: 600,
        }}>
          {pendientes.length > 0 ? `${pendientes.length} pendiente${pendientes.length !== 1 ? "s" : ""}` : "✓ Al día"}
        </span>
      </div>

      {/* Pedido rows */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: isS ? 2 : 4, padding: isS ? "4px 6px 6px" : isL ? "8px 10px 10px" : "6px 8px 8px" }}>
        {pendientes.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: isS ? 10 : 12, textAlign: "center", paddingTop: isS ? 4 : 10, fontStyle: "italic" }}>
            Sin pedidos pendientes
          </div>
        ) : (
          pendientes.map((p) => {
            const estado = computeEstadoPedido(now, p.horaPreparacion, p.horaRetiro, p.horaEntrega);
            const c = ESTADO_COLORS[estado] ?? ESTADO_COLORS.PENDIENTE;
            const nombreCorto = isS ? p.cliente.split(" ").slice(0, 2).join(" ") : p.cliente;

            return (
              <div key={p.id} style={{
                background: c.bg,
                border: `1.5px solid ${c.border}`,
                borderRadius: isS ? 5 : 7,
                padding: isS ? "4px 8px" : isL ? "10px 12px" : "7px 10px",
                display: "flex",
                flexDirection: isL ? "column" : "row",
                alignItems: isL ? "stretch" : "center",
                justifyContent: "space-between",
                gap: isL ? 6 : 4,
                minHeight: isS ? 26 : undefined,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: isS ? 5 : 7, minWidth: 0 }}>
                  <span style={{ fontSize: isS ? 12 : isL ? 16 : 14 }}>{ESTADO_EMOJI[estado]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "nowrap" }}>
                      <span style={{ color: c.text, fontWeight: 800, fontSize: isS ? 11 : isL ? 15 : 13, whiteSpace: "nowrap" }}>
                        #{p.id}
                      </span>
                      <span style={{ color: c.text, fontWeight: 500, fontSize: isS ? 11 : isL ? 14 : 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {nombreCorto}
                      </span>
                    </div>
                    {!isS && (
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 1 }}>
                        {isL
                          ? p.items.map((i) => `${i.nombreProducto}${i.extraNombre ? ` (${i.extraNombre})` : ""} x${i.cantidad}`).join(", ")
                          : formatHora(p.horaEntrega)}
                      </div>
                    )}
                    {isL && (
                      <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginTop: 2 }}>
                        🕐 {formatHora(p.horaEntrega)}
                      </div>
                    )}
                  </div>
                </div>
                <span style={{
                  background: c.chip,
                  color: c.text,
                  borderRadius: 4,
                  padding: isS ? "1px 5px" : "3px 8px",
                  fontSize: isS ? 9 : 10,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  alignSelf: isL ? "flex-start" : "center",
                }}>
                  {ESTADO_PEDIDO_LABELS[estado]}
                </span>
              </div>
            );
          })
        )}

        {/* Overflow indicator */}
        {pedidos.filter((p) => !p.pedidoEntregado).length > 2 && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center" }}>
            +{pedidos.filter((p) => !p.pedidoEntregado).length - 2} más
          </div>
        )}
      </div>
    </div>
  );
}

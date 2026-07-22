"use client";

import { useEffect, useRef, useState } from "react";
import type { AlarmasConfig, PedidoPendiente } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT } from "@/lib/types";
import { reproducirAlarma } from "@/lib/alarmas";
import {
  computeEstadoPedido,
  ESTADO_PEDIDO_LABELS as ESTADO_LABELS,
  formatHora,
} from "@/lib/pedidos";

type AlarmaInfo = {
  prepProximoBeep: number | null;
  retiroProximoBeep: number | null;
  entregaProximoBeep: number | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type AlertaActiva = {
  pedidoId: number;
  cliente: string;
  productos: string;
  horaEntrega: string | null;
  etapa: "prep" | "retiro" | "entrega";
  etapaLabel: string;
  etapaEmoji: string;
};

type AlertaConfig = {
  modo: "overlay" | "popup";
  overlay: { velocidad: "lento" | "normal" | "rapido"; colorA: string; colorB: string };
  popup: { ancho: number; alto: number };
  widget: { size: "s" | "m" | "l" };
};

const ALERTA_CONFIG_DEFAULT: AlertaConfig = {
  modo: "overlay",
  overlay: { velocidad: "normal", colorA: "#dc2626", colorB: "#ea580c" },
  popup: { ancho: 480, alto: 360 },
  widget: { size: "m" },
};

const WIDGET_DIMS = {
  s: { w: 260, h: 112 },
  m: { w: 340, h: 178 },
  l: { w: 500, h: 256 },
};

const VELOCIDADES: Record<string, number> = { lento: 900, normal: 500, rapido: 250 };

function useErpTheme() {
  useEffect(() => {
    const saved = localStorage.getItem("erp-theme") ?? "hg";
    document.documentElement.setAttribute("data-theme", saved);
  }, []);
}

export default function ComandaClient() {
  useErpTheme();

  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [silenciados, setSilenciados] = useState<Record<string, number>>({});
  const [mostrarEntregados, setMostrarEntregados] = useState(false);
  const [notifPermiso, setNotifPermiso] = useState<NotificationPermission>("default");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Alert system
  const [alertaActiva, setAlertaActiva] = useState<AlertaActiva | null>(null);
  const alertaActivaRef = useRef<AlertaActiva | null>(null);
  const alertaQueue = useRef<AlertaActiva[]>([]);
  const [alertaQueueLen, setAlertaQueueLen] = useState(0);
  const alertasKeys = useRef<Set<string>>(new Set());
  const [flashOn, setFlashOn] = useState(false);

  // Config
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [alertaConfig, setAlertaConfigState] = useState<AlertaConfig>(ALERTA_CONFIG_DEFAULT);
  const alertaConfigRef = useRef<AlertaConfig>(ALERTA_CONFIG_DEFAULT);

  const alarmas = useRef<Map<number, AlarmaInfo>>(new Map());
  const alarmasConfig = useRef<AlarmasConfig>(ALARMAS_CONFIG_DEFAULT);

  // Load alert config from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("comandera-alerta-config");
      if (raw) {
        const cfg = { ...ALERTA_CONFIG_DEFAULT, ...JSON.parse(raw) };
        alertaConfigRef.current = cfg;
        setAlertaConfigState(cfg);
      }
    } catch {}
  }, []);

  function saveAlertaConfig(config: AlertaConfig) {
    localStorage.setItem("comandera-alerta-config", JSON.stringify(config));
    alertaConfigRef.current = config;
    setAlertaConfigState(config);
  }

  // Flash toggle
  useEffect(() => {
    if (!alertaActiva || alertaConfig.modo !== "overlay") return;
    const ms = VELOCIDADES[alertaConfig.overlay.velocidad] ?? 500;
    const iv = setInterval(() => setFlashOn((v) => !v), ms);
    return () => clearInterval(iv);
  }, [alertaActiva, alertaConfig.modo, alertaConfig.overlay.velocidad]);

  // Title flash
  useEffect(() => {
    if (!alertaActiva) { document.title = "Comandera"; return; }
    const msgs = [
      `🚨 ${alertaActiva.etapaLabel.toUpperCase()} — #${alertaActiva.pedidoId}`,
      "⚠️ VER ALERTA — Comandera",
    ];
    let i = 0;
    const iv = setInterval(() => { document.title = msgs[i++ % 2]; }, 800);
    return () => { clearInterval(iv); document.title = "Comandera"; };
  }, [alertaActiva]);

  function dispatchAlerta(alerta: AlertaActiva) {
    const cfg = alertaConfigRef.current;
    if (cfg.modo === "popup") {
      abrirPopup(alerta, cfg);
      return;
    }
    if (alertaActivaRef.current === null) {
      alertaActivaRef.current = alerta;
      setAlertaActiva(alerta);
    } else {
      alertaQueue.current.push(alerta);
      setAlertaQueueLen(alertaQueue.current.length);
    }
  }

  function abrirWidget() {
    const size = alertaConfigRef.current.widget?.size ?? "m";
    const { w, h } = WIDGET_DIMS[size];
    const left = screen.width - w - 24;
    const top = 80;
    window.open(`/widget?size=${size}`, "hg-widget", `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no`);
  }

  function abrirPopup(alerta: AlertaActiva, cfg: AlertaConfig) {
    const { ancho, alto } = cfg.popup;
    const left = Math.round((screen.width - ancho) / 2);
    const top = Math.round((screen.height - alto) / 2);
    const params = new URLSearchParams({
      id: String(alerta.pedidoId),
      cliente: alerta.cliente,
      etapa: alerta.etapaLabel,
      emoji: alerta.etapaEmoji,
      hora: alerta.horaEntrega ?? "-",
      productos: alerta.productos,
      colorA: cfg.overlay.colorA,
      colorB: cfg.overlay.colorB,
      velocidad: cfg.overlay.velocidad,
    });
    window.open(
      `/alerta?${params}`,
      `alerta-${alerta.pedidoId}-${alerta.etapa}`,
      `width=${ancho},height=${alto},left=${left},top=${top},resizable=yes,scrollbars=no`
    );
  }

  function dismissAlerta() {
    const a = alertaActivaRef.current;
    if (a) {
      alertasKeys.current.delete(`${a.pedidoId}-${a.etapa}`);
      silenciar(a.pedidoId, a.etapa);
    }
    const next = alertaQueue.current.shift() ?? null;
    setAlertaQueueLen(alertaQueue.current.length);
    alertaActivaRef.current = next;
    setAlertaActiva(next);
  }

  // PWA install
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalado(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPermiso(Notification.permission);
  }, []);

  async function pedirPermisoNotificaciones() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPermiso(p);
  }

  function mostrarNotificacion(titulo: string, cuerpo: string, tag: string) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!document.hidden) return;
    const n = new Notification(titulo, { body: cuerpo, tag, requireInteraction: true, icon: "/icons/icon-192-v2.png" });
    n.onclick = () => { window.focus(); n.close(); };
  }

  async function loadAlarmasConfig() {
    try { const res = await fetch("/api/alarmas-config"); if (res.ok) alarmasConfig.current = await res.json(); } catch { /* default */ }
  }

  async function loadPedidos() {
    try {
      const res = await fetch("/api/pedidos-pendientes");
      const data = (await res.json()) as PedidoPendiente[];
      const idsPend = new Set(data.filter((p) => !p.pedidoEntregado).map((p) => p.id));
      for (const id of alarmas.current.keys()) { if (!idsPend.has(id)) alarmas.current.delete(id); }
      for (const p of data) {
        if (!p.pedidoEntregado && !alarmas.current.has(p.id)) {
          alarmas.current.set(p.id, { prepProximoBeep: null, retiroProximoBeep: null, entregaProximoBeep: null });
        }
      }
      setPedidos(data);
    } catch { /* silenciar */ } finally { setLoading(false); }
  }

  useEffect(() => {
    loadAlarmasConfig();
    loadPedidos();
    const iv = setInterval(loadPedidos, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      const t = Date.now();
      for (const pedido of pedidos) {
        if (pedido.pedidoEntregado) continue;
        const info = alarmas.current.get(pedido.id);
        if (!info) continue;
        const estado = computeEstadoPedido(t, pedido.horaPreparacion, pedido.horaRetiro, pedido.horaEntrega);
        const productos = pedido.items.map((i) => `${i.nombreProducto}${i.extraNombre ? ` (${i.extraNombre})` : ""} x${i.cantidad}`).join(", ");
        const horaEntrega = pedido.horaEntrega ? formatHora(pedido.horaEntrega) : null;

        if (estado === "PREPARAR") {
          const cfg = alarmasConfig.current.preparacion;
          if (info.prepProximoBeep === null) info.prepProximoBeep = t;
          if (t >= info.prepProximoBeep) {
            reproducirAlarma(cfg, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            mostrarNotificacion(`⏰ Pedido #${pedido.id}`, `${pedido.cliente} — Preparar ahora`, `prep-${pedido.id}`);
            const key = `${pedido.id}-prep`;
            if (!alertasKeys.current.has(key)) {
              alertasKeys.current.add(key);
              dispatchAlerta({ pedidoId: pedido.id, cliente: pedido.cliente, productos, horaEntrega, etapa: "prep", etapaLabel: "Preparar ahora", etapaEmoji: "⏰" });
            }
            info.prepProximoBeep = t + cfg.repetirSegundos * 1000;
          }
        }
        if (estado === "RETIRO") {
          const cfg = alarmasConfig.current.retiro;
          if (info.retiroProximoBeep === null) info.retiroProximoBeep = t;
          if (t >= info.retiroProximoBeep) {
            reproducirAlarma(cfg, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            mostrarNotificacion(`🚗 Pedido #${pedido.id}`, `${pedido.cliente} — Listo para retiro`, `retiro-${pedido.id}`);
            const key = `${pedido.id}-retiro`;
            if (!alertasKeys.current.has(key)) {
              alertasKeys.current.add(key);
              dispatchAlerta({ pedidoId: pedido.id, cliente: pedido.cliente, productos, horaEntrega, etapa: "retiro", etapaLabel: "Listo para retiro", etapaEmoji: "🚗" });
            }
            info.retiroProximoBeep = t + cfg.repetirSegundos * 1000;
          }
        }
        if (estado === "ENTREGAR") {
          const cfg = alarmasConfig.current.entrega;
          if (info.entregaProximoBeep === null) info.entregaProximoBeep = t;
          if (t >= info.entregaProximoBeep) {
            reproducirAlarma(cfg, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            mostrarNotificacion(`🏠 Pedido #${pedido.id}`, `${pedido.cliente} — Entregar ya`, `entrega-${pedido.id}`);
            const key = `${pedido.id}-entrega`;
            if (!alertasKeys.current.has(key)) {
              alertasKeys.current.add(key);
              dispatchAlerta({ pedidoId: pedido.id, cliente: pedido.cliente, productos, horaEntrega, etapa: "entrega", etapaLabel: "Entregar ya", etapaEmoji: "🏠" });
            }
            info.entregaProximoBeep = t + cfg.repetirSegundos * 1000;
          }
        }
      }
      setNow(t);
    }, 1000);
    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos]);

  function silenciar(pedidoId: number, etapa: "prep" | "retiro" | "entrega") {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    const mins = etapa === "prep" ? alarmasConfig.current.preparacion.silenciarMinutos
      : etapa === "retiro" ? alarmasConfig.current.retiro.silenciarMinutos
      : alarmasConfig.current.entrega.silenciarMinutos;
    const proximo = Date.now() + mins * 60_000;
    if (etapa === "prep") info.prepProximoBeep = proximo;
    else if (etapa === "retiro") info.retiroProximoBeep = proximo;
    else info.entregaProximoBeep = proximo;
    setSilenciados((prev) => ({ ...prev, [`${pedidoId}-${etapa}`]: proximo }));
    setNow(Date.now() + 1);
  }

  async function aceptarRetiro(pedidoId: number) {
    await fetch(`/api/pedidos-pendientes/${pedidoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enviado: true }) });
    await loadPedidos();
  }

  async function aceptarEntrega(pedidoId: number) {
    await fetch(`/api/pedidos-pendientes/${pedidoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entregado: true }) });
    alarmas.current.delete(pedidoId);
    await loadPedidos();
  }

  async function volverAPendiente(pedidoId: number) {
    await fetch(`/api/pedidos-pendientes/${pedidoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entregado: false }) });
    await loadPedidos();
  }

  async function instalarApp() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalado(true);
    setDeferredPrompt(null);
  }

  function copiarEnlace() {
    navigator.clipboard.writeText(`${window.location.origin}/comandera`).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    });
  }

  const ESTADO_CLASES: Record<string, string> = {
    PENDIENTE: "border-zinc-300 bg-[var(--erp-surface)]",
    PREPARAR:  "border-yellow-400 bg-yellow-50",
    RETIRO:    "border-blue-400 bg-blue-50",
    ENTREGAR:  "border-green-500 bg-green-50",
  };

  const pendientes = pedidos.filter((p) => !p.pedidoEntregado);
  const entregados = pedidos.filter((p) => p.pedidoEntregado);

  const colorFlash = flashOn ? alertaConfig.overlay.colorA : alertaConfig.overlay.colorB;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--erp-bg)", color: "var(--erp-text)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", display: "flex", flexDirection: "column" }}>

      {/* Alert Overlay */}
      {alertaActiva && alertaConfig.modo === "overlay" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: colorFlash, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: 32 }}>
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>{alertaActiva.etapaEmoji}</div>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 8, textTransform: "uppercase" }}>
              {alertaActiva.etapaLabel}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
              Pedido #{alertaActiva.pedidoId} — {alertaActiva.cliente}
            </div>
            {alertaActiva.horaEntrega && (
              <div style={{ fontSize: 17, opacity: 0.92, marginBottom: 8 }}>
                🕐 Entrega: {alertaActiva.horaEntrega}
              </div>
            )}
            <div style={{ fontSize: 14, opacity: 0.85, maxWidth: 520, margin: "0 auto", lineHeight: 1.5 }}>
              {alertaActiva.productos}
            </div>
          </div>
          <button
            onClick={dismissAlerta}
            style={{ background: "#fff", color: alertaConfig.overlay.colorA, border: "none", borderRadius: 14, padding: "18px 56px", fontSize: 22, fontWeight: 900, cursor: "pointer", boxShadow: "0 6px 32px rgba(0,0,0,0.35)", letterSpacing: "-0.01em" }}
          >
            ✓ Entendido
          </button>
          {alertaQueueLen > 0 && (
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600 }}>
              +{alertaQueueLen} alerta{alertaQueueLen !== 1 ? "s" : ""} más en cola
            </div>
          )}
        </div>
      )}

      {/* Config Modal */}
      {mostrarConfig && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setMostrarConfig(false)}
        >
          <div
            style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--erp-text)" }}>⚙️ Configuración de Alertas</h3>

            {/* Modo */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Modo de Alerta</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["overlay", "popup"] as const).map((m) => (
                  <button key={m} onClick={() => saveAlertaConfig({ ...alertaConfig, modo: m })}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "2px solid", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                      borderColor: alertaConfig.modo === m ? "var(--erp-primary)" : "var(--erp-border)",
                      background: alertaConfig.modo === m ? "var(--erp-primary-lt)" : "transparent",
                      color: alertaConfig.modo === m ? "var(--erp-primary)" : "var(--erp-text)" }}>
                    {m === "overlay" ? "🖥️ Overlay" : "🪟 Popup"}
                  </button>
                ))}
              </div>
            </div>

            {/* Overlay options */}
            {alertaConfig.modo === "overlay" && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Velocidad del Flash</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["lento", "normal", "rapido"] as const).map((v) => (
                      <button key={v} onClick={() => saveAlertaConfig({ ...alertaConfig, overlay: { ...alertaConfig.overlay, velocidad: v } })}
                        style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "2px solid", cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.15s",
                          borderColor: alertaConfig.overlay.velocidad === v ? "var(--erp-primary)" : "var(--erp-border)",
                          background: alertaConfig.overlay.velocidad === v ? "var(--erp-primary-lt)" : "transparent",
                          color: alertaConfig.overlay.velocidad === v ? "var(--erp-primary)" : "var(--erp-text)" }}>
                        {v === "lento" ? "🐢 Lento" : v === "normal" ? "⚡ Normal" : "🔥 Rápido"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                  {(["colorA", "colorB"] as const).map((k, idx) => (
                    <div key={k} style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        Color {idx === 0 ? "A" : "B"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="color" value={alertaConfig.overlay[k]}
                          onChange={(e) => saveAlertaConfig({ ...alertaConfig, overlay: { ...alertaConfig.overlay, [k]: e.target.value } })}
                          style={{ width: 40, height: 34, border: "none", cursor: "pointer", borderRadius: 6, padding: 2 }} />
                        <span style={{ fontSize: 12, color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{alertaConfig.overlay[k]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Preview */}
                <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", height: 36, display: "flex" }}>
                  <div style={{ flex: 1, background: alertaConfig.overlay.colorA }} />
                  <div style={{ flex: 1, background: alertaConfig.overlay.colorB }} />
                </div>
              </>
            )}

            {/* Popup options */}
            {alertaConfig.modo === "popup" && (
              <>
                <div style={{ fontSize: 12, color: "var(--erp-text-2)", background: "var(--erp-bg)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, lineHeight: 1.5 }}>
                  ⚠️ El popup depende del navegador — puede quedar detrás de otras ventanas. Funciona mejor con la Comandera instalada como PWA.
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {(["ancho", "alto"] as const).map((k) => (
                    <div key={k} style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                        {k === "ancho" ? "Ancho (px)" : "Alto (px)"}
                      </div>
                      <input type="number" value={alertaConfig.popup[k]} min={k === "ancho" ? 300 : 200} max={k === "ancho" ? 900 : 700}
                        onChange={(e) => saveAlertaConfig({ ...alertaConfig, popup: { ...alertaConfig.popup, [k]: Number(e.target.value) } })}
                        style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 14, background: "var(--erp-bg)", color: "var(--erp-text)" }} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Widget size */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--erp-border)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Tamaño del Widget</div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["s", "m", "l"] as const).map((sz) => (
                  <button key={sz} onClick={() => saveAlertaConfig({ ...alertaConfig, widget: { size: sz } })}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "2px solid", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.15s",
                      borderColor: (alertaConfig.widget?.size ?? "m") === sz ? "var(--erp-primary)" : "var(--erp-border)",
                      background: (alertaConfig.widget?.size ?? "m") === sz ? "var(--erp-primary-lt)" : "transparent",
                      color: (alertaConfig.widget?.size ?? "m") === sz ? "var(--erp-primary)" : "var(--erp-text)" }}>
                    {sz === "s" ? "S\n260×112" : sz === "m" ? "M\n340×178" : "L\n500×256"}
                  </button>
                ))}
              </div>
              <button onClick={abrirWidget}
                style={{ marginTop: 10, width: "100%", padding: "9px", background: "#18181b", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                📟 Abrir Widget ahora
              </button>
            </div>

            <button onClick={() => setMostrarConfig(false)}
              style={{ marginTop: 16, width: "100%", padding: "11px", background: "var(--erp-shell)", color: "var(--erp-shell-text)", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Shell bar */}
      <div style={{ background: "var(--erp-shell)", borderBottom: "1px solid var(--erp-border)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192-v2.png" alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-shell-text)", letterSpacing: "-0.01em" }}>Comandera</span>
          <span style={{ fontSize: 12, background: pendientes.length > 0 ? "var(--erp-primary)" : "var(--erp-border)", color: pendientes.length > 0 ? "#fff" : "var(--erp-text-3)", borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>
            {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={abrirWidget}
            style={{ background: "transparent", color: "var(--erp-shell-text)", border: "1px solid var(--erp-shell-text)44", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            title="Abrir widget flotante">
            📟 Widget
          </button>
          <button onClick={() => setMostrarConfig(true)}
            style={{ background: "transparent", color: "var(--erp-shell-text)", border: "1px solid var(--erp-shell-text)44", borderRadius: 8, padding: "5px 10px", fontSize: 13, cursor: "pointer" }}
            title="Configurar alertas">
            ⚙️
          </button>
          {notifPermiso !== "granted" && (
            <button onClick={pedirPermisoNotificaciones} style={{ background: "#f59e0b", color: "#18181b", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              🔔 Activar alertas
            </button>
          )}
          {deferredPrompt && !instalado && (
            <button onClick={instalarApp} style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              📲 Instalar app
            </button>
          )}
          <button onClick={copiarEnlace} style={{ background: "transparent", color: "var(--erp-shell-text)", border: "1px solid var(--erp-shell-text)33", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {copiado ? "✓ Copiado" : "🔗 Copiar enlace"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {loading && (
          <div style={{ textAlign: "center", color: "var(--erp-text-3)", paddingTop: 48 }}>Cargando...</div>
        )}

        {!loading && pendientes.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm" style={{ color: "var(--erp-text-3)" }}>
            No hay pedidos pendientes por entregar
          </div>
        )}

        {pendientes.map((pedido) => {
          const estado = computeEstadoPedido(now, pedido.horaPreparacion, pedido.horaRetiro, pedido.horaEntrega);
          const clases = ESTADO_CLASES[estado] ?? "border-zinc-300 bg-white";
          const silPrep    = now < (silenciados[`${pedido.id}-prep`]    ?? 0);
          const silRetiro  = now < (silenciados[`${pedido.id}-retiro`]  ?? 0);
          const silEntrega = now < (silenciados[`${pedido.id}-entrega`] ?? 0);

          return (
            <div key={pedido.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${pedido.pedidoAceptado ? "border-blue-300 bg-blue-100" : clases}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Pedido #{pedido.id} — {pedido.cliente}</h3>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col text-sm text-zinc-700">
                    <span><span className="font-medium">Hora de entrega: </span>{formatHora(pedido.horaEntrega)}</span>
                    {(pedido.horaEntrega || pedido.fecha) && (
                      <span>
                        <span className="font-medium">Fecha: </span>
                        {(() => { const d = pedido.horaEntrega ? new Date(pedido.horaEntrega).toLocaleDateString("en-CA", { timeZone: "America/Caracas" }) : pedido.fecha; return d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4); })()}
                      </span>
                    )}
                  </div>
                  <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold uppercase">
                    {ESTADO_LABELS[estado]}
                  </span>
                  {pedido.pedidoAceptado && (
                    <span className="rounded-md border border-blue-400 bg-blue-100 px-2 py-1 text-xs font-semibold uppercase text-blue-800">
                      Aceptado{pedido.deliveryAsignado ? ` (${pedido.deliveryAsignado})` : ""}
                    </span>
                  )}
                  {pedido.pedidoEnviado && (
                    <span className="rounded-md border border-green-400 bg-green-100 px-2 py-1 text-xs font-semibold uppercase text-green-800">Retirado</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1 text-sm text-zinc-700 sm:grid-cols-2">
                <div><span className="font-medium">Frito o Congelado: </span>{pedido.fritoCongelado}</div>
                <div><span className="font-medium">Dirección: </span>{pedido.direccion ?? "-"}</div>
                <div><span className="font-medium">Productos: </span>{pedido.items.map((i) => `${i.nombreProducto}${i.extraNombre ? ` (${i.extraNombre})` : ""} x${i.cantidad}`).join(", ")}</div>
                <div><span className="font-medium">Delivery: </span>{pedido.deliveryAsignado ?? "-"}</div>
                <div><span className="font-medium">Hora preparación: </span>{formatHora(pedido.horaPreparacion)}</div>
                <div><span className="font-medium">Hora retiro: </span>{pedido.horaRetiro ? formatHora(pedido.horaRetiro) : "-"}</div>
              </div>

              {estado === "PREPARAR" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => silenciar(pedido.id, "prep")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${silPrep ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200" : "border-zinc-400 bg-white hover:bg-zinc-100"}`}>
                    {silPrep ? "Silenciado" : "Silenciar"}
                  </button>
                </div>
              )}
              {estado === "RETIRO" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => silenciar(pedido.id, "retiro")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${silRetiro ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200" : "border-zinc-400 bg-white hover:bg-zinc-100"}`}>
                    {silRetiro ? "Silenciado" : "Silenciar"}
                  </button>
                  {!pedido.pedidoEnviado && (
                    <button type="button" onClick={() => aceptarRetiro(pedido.id)}
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                      Aceptar (retirado)
                    </button>
                  )}
                </div>
              )}
              {estado === "ENTREGAR" && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => silenciar(pedido.id, "entrega")}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium ${silEntrega ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200" : "border-zinc-400 bg-white hover:bg-zinc-100"}`}>
                    {silEntrega ? "Silenciado" : "Silenciar"}
                  </button>
                  <button type="button" onClick={() => aceptarEntrega(pedido.id)}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                    Aceptar (entregado)
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {entregados.length > 0 && (
          <div className="rounded-lg border border-green-200 bg-green-50">
            <button type="button" onClick={() => setMostrarEntregados((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-green-800">
              <span>Pedidos entregados hoy ({entregados.length})</span>
              <span>{mostrarEntregados ? "▲" : "▼"}</span>
            </button>
            {mostrarEntregados && (
              <div className="flex flex-col gap-2 px-4 pb-4">
                {entregados.map((pedido) => (
                  <div key={pedido.id} className="flex items-center justify-between rounded-md border border-green-300 bg-white px-3 py-2 text-sm">
                    <span className="font-medium">#{pedido.id} — {pedido.cliente}</span>
                    <button type="button" onClick={() => volverAPendiente(pedido.id)}
                      className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100">
                      Volver a pendiente
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

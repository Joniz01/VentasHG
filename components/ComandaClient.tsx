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

const ESTADO_COLORES: Record<string, string> = {
  PENDIENTE: "#27272a",
  PREPARAR: "#92400e",
  RETIRO:   "#1e3a5f",
  ENTREGAR: "#14532d",
};

const ESTADO_BG: Record<string, string> = {
  PENDIENTE: "#3f3f46",
  PREPARAR:  "#fef3c7",
  RETIRO:    "#dbeafe",
  ENTREGAR:  "#dcfce7",
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function ComandaClient() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [silenciados, setSilenciados] = useState<Record<string, number>>({});
  const [notifPermiso, setNotifPermiso] = useState<NotificationPermission>("default");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const alarmas = useRef<Map<number, AlarmaInfo>>(new Map());
  const alarmasConfig = useRef<AlarmasConfig>(ALARMAS_CONFIG_DEFAULT);

  // Capturar evento de instalación PWA
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalado(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Pedir permiso de notificaciones
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermiso(Notification.permission);
    }
  }, []);

  async function pedirPermisoNotificaciones() {
    if (typeof Notification === "undefined") return;
    const permiso = await Notification.requestPermission();
    setNotifPermiso(permiso);
  }

  function mostrarNotificacion(titulo: string, cuerpo: string, tag: string) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!document.hidden) return; // solo cuando está en segundo plano
    const n = new Notification(titulo, {
      body: cuerpo,
      tag,
      requireInteraction: true,
      icon: "/icons/icon-192.png",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }

  async function loadAlarmasConfig() {
    try {
      const res = await fetch("/api/alarmas-config");
      if (res.ok) alarmasConfig.current = await res.json();
    } catch { /* usar default */ }
  }

  async function loadPedidos() {
    try {
      const res = await fetch("/api/pedidos-pendientes");
      const data = (await res.json()) as PedidoPendiente[];
      const idsPendientes = new Set(data.filter((p) => !p.pedidoEntregado).map((p) => p.id));
      for (const id of alarmas.current.keys()) {
        if (!idsPendientes.has(id)) alarmas.current.delete(id);
      }
      for (const pedido of data) {
        if (!pedido.pedidoEntregado && !alarmas.current.has(pedido.id)) {
          alarmas.current.set(pedido.id, { prepProximoBeep: null, retiroProximoBeep: null, entregaProximoBeep: null });
        }
      }
      setPedidos(data);
    } catch { /* silenciar */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    loadAlarmasConfig();
    loadPedidos();
    const interval = setInterval(loadPedidos, 30_000);
    return () => clearInterval(interval);
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

        if (estado === "PREPARAR") {
          const cfg = alarmasConfig.current.preparacion;
          if (info.prepProximoBeep === null) info.prepProximoBeep = t;
          if (t >= info.prepProximoBeep) {
            reproducirAlarma(cfg, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            mostrarNotificacion(`⏰ Pedido #${pedido.id}`, `${pedido.cliente} — Preparar ahora`, `prep-${pedido.id}`);
            info.prepProximoBeep = t + cfg.repetirSegundos * 1000;
          }
        }
        if (estado === "RETIRO") {
          const cfg = alarmasConfig.current.retiro;
          if (info.retiroProximoBeep === null) info.retiroProximoBeep = t;
          if (t >= info.retiroProximoBeep) {
            reproducirAlarma(cfg, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            mostrarNotificacion(`🚗 Pedido #${pedido.id}`, `${pedido.cliente} — Listo para retiro`, `retiro-${pedido.id}`);
            info.retiroProximoBeep = t + cfg.repetirSegundos * 1000;
          }
        }
        if (estado === "ENTREGAR") {
          const cfg = alarmasConfig.current.entrega;
          if (info.entregaProximoBeep === null) info.entregaProximoBeep = t;
          if (t >= info.entregaProximoBeep) {
            reproducirAlarma(cfg, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            mostrarNotificacion(`🏠 Pedido #${pedido.id}`, `${pedido.cliente} — Entregar ya`, `entrega-${pedido.id}`);
            info.entregaProximoBeep = t + cfg.repetirSegundos * 1000;
          }
        }
      }
      setNow(t);
    }, 1000);
    return () => clearInterval(tick);
  }, [pedidos]);

  function silenciar(pedidoId: number, etapa: "prep" | "retiro" | "entrega") {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    const mins = etapa === "prep"
      ? alarmasConfig.current.preparacion.silenciarMinutos
      : etapa === "retiro"
        ? alarmasConfig.current.retiro.silenciarMinutos
        : alarmasConfig.current.entrega.silenciarMinutos;
    const proximo = now + mins * 60_000;
    if (etapa === "prep") info.prepProximoBeep = proximo;
    else if (etapa === "retiro") info.retiroProximoBeep = proximo;
    else info.entregaProximoBeep = proximo;
    setSilenciados((prev) => ({ ...prev, [`${pedidoId}-${etapa}`]: proximo }));
    setNow(now + 1);
  }

  async function aceptarRetiro(pedidoId: number) {
    await fetch(`/api/pedidos-pendientes/${pedidoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enviado: true }),
    });
    await loadPedidos();
  }

  async function aceptarEntrega(pedidoId: number) {
    await fetch(`/api/pedidos-pendientes/${pedidoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entregado: true }),
    });
    alarmas.current.delete(pedidoId);
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
    const url = `${window.location.origin}/comandera`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  const pendientes = pedidos.filter((p) => !p.pedidoEntregado);
  const entregados = pedidos.filter((p) => p.pedidoEntregado);

  return (
    <div style={{ minHeight: "100dvh", background: "#18181b", color: "#f4f4f5", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", display: "flex", flexDirection: "column" }}>
      {/* Barra superior */}
      <div style={{ background: "#27272a", borderBottom: "1px solid #3f3f46", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#f4f4f5", letterSpacing: "-0.01em" }}>🍽️ Comandera</span>
          <span style={{ fontSize: 12, background: pendientes.length > 0 ? "#dc2626" : "#3f3f46", color: pendientes.length > 0 ? "#fff" : "#a1a1aa", borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>
            {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {notifPermiso !== "granted" && (
            <button onClick={pedirPermisoNotificaciones} style={{ background: "#f59e0b", color: "#18181b", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              🔔 Activar alertas
            </button>
          )}
          {deferredPrompt && !instalado && (
            <button onClick={instalarApp} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              📲 Instalar app
            </button>
          )}
          <button onClick={copiarEnlace} style={{ background: "#3f3f46", color: "#e4e4e7", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {copiado ? "✓ Copiado" : "🔗 Copiar enlace"}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {loading && (
          <div style={{ textAlign: "center", color: "#71717a", paddingTop: 48 }}>Cargando pedidos…</div>
        )}

        {!loading && pendientes.length === 0 && (
          <div style={{ textAlign: "center", color: "#71717a", paddingTop: 48, fontSize: 15 }}>
            Sin pedidos pendientes ✓
          </div>
        )}

        {pendientes.map((pedido) => {
          const estado = computeEstadoPedido(now, pedido.horaPreparacion, pedido.horaRetiro, pedido.horaEntrega);
          const bg = ESTADO_BG[estado] ?? "#3f3f46";
          const col = ESTADO_COLORES[estado] ?? "#f4f4f5";
          const silPrep = now < (silenciados[`${pedido.id}-prep`] ?? 0);
          const silRetiro = now < (silenciados[`${pedido.id}-retiro`] ?? 0);
          const silEntrega = now < (silenciados[`${pedido.id}-entrega`] ?? 0);

          return (
            <div key={pedido.id} style={{ background: bg, border: `2px solid ${col}30`, borderRadius: 12, padding: 16, color: col }}>
              {/* Cabecera */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>#{pedido.id} — {pedido.cliente}</span>
                <span style={{ background: col, color: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {ESTADO_LABELS[estado]}
                </span>
              </div>

              {/* Info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 13, marginBottom: 10 }}>
                <div><span style={{ opacity: 0.7 }}>Entrega:</span> <strong>{formatHora(pedido.horaEntrega)}</strong></div>
                <div><span style={{ opacity: 0.7 }}>Preparar:</span> <strong>{formatHora(pedido.horaPreparacion)}</strong></div>
                <div style={{ gridColumn: "1/-1" }}><span style={{ opacity: 0.7 }}>Productos:</span> {pedido.items.map((i) => `${i.nombreProducto}${i.extraNombre ? ` (${i.extraNombre})` : ""} x${i.cantidad}`).join(", ")}</div>
                {pedido.fritoCongelado && pedido.fritoCongelado !== "—" && (
                  <div><span style={{ opacity: 0.7 }}>Tipo:</span> <strong>{pedido.fritoCongelado}</strong></div>
                )}
                {pedido.direccion && (
                  <div style={{ gridColumn: "1/-1" }}><span style={{ opacity: 0.7 }}>Dirección:</span> {pedido.direccion}</div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {estado === "PREPARAR" && (
                  <button onClick={() => silenciar(pedido.id, "prep")} style={{ background: silPrep ? "#d97706" : "#52525b", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {silPrep ? "Silenciado" : "Silenciar"}
                  </button>
                )}
                {estado === "RETIRO" && (
                  <>
                    <button onClick={() => silenciar(pedido.id, "retiro")} style={{ background: silRetiro ? "#d97706" : "#52525b", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      {silRetiro ? "Silenciado" : "Silenciar"}
                    </button>
                    {!pedido.pedidoEnviado && (
                      <button onClick={() => aceptarRetiro(pedido.id)} style={{ background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✓ Retirado
                      </button>
                    )}
                  </>
                )}
                {estado === "ENTREGAR" && (
                  <>
                    <button onClick={() => silenciar(pedido.id, "entrega")} style={{ background: silEntrega ? "#d97706" : "#52525b", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      {silEntrega ? "Silenciado" : "Silenciar"}
                    </button>
                    <button onClick={() => aceptarEntrega(pedido.id)} style={{ background: "#15803d", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Entregado
                    </button>
                  </>
                )}
                {pedido.pedidoEnviado && (
                  <span style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>Retirado por motorizado</span>
                )}
              </div>
            </div>
          );
        })}

        {entregados.length > 0 && (
          <div style={{ marginTop: 8, padding: "8px 14px", background: "#27272a", borderRadius: 10, fontSize: 12, color: "#71717a", textAlign: "center" }}>
            {entregados.length} pedido{entregados.length !== 1 ? "s" : ""} entregado{entregados.length !== 1 ? "s" : ""} hoy ✓
          </div>
        )}
      </div>
    </div>
  );
}

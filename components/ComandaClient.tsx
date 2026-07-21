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

// Applies the saved ERP theme on first render (default: hg)
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

  const alarmas = useRef<Map<number, AlarmaInfo>>(new Map());
  const alarmasConfig = useRef<AlarmasConfig>(ALARMAS_CONFIG_DEFAULT);

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
    const n = new Notification(titulo, { body: cuerpo, tag, requireInteraction: true, icon: "/icons/icon-192.png" });
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
    const mins = etapa === "prep" ? alarmasConfig.current.preparacion.silenciarMinutos
      : etapa === "retiro" ? alarmasConfig.current.retiro.silenciarMinutos
      : alarmasConfig.current.entrega.silenciarMinutos;
    const proximo = now + mins * 60_000;
    if (etapa === "prep") info.prepProximoBeep = proximo;
    else if (etapa === "retiro") info.retiroProximoBeep = proximo;
    else info.entregaProximoBeep = proximo;
    setSilenciados((prev) => ({ ...prev, [`${pedidoId}-${etapa}`]: proximo }));
    setNow(now + 1);
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

  return (
    <div style={{ minHeight: "100dvh", background: "var(--erp-bg)", color: "var(--erp-text)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", display: "flex", flexDirection: "column" }}>

      {/* Barra superior */}
      <div style={{ background: "var(--erp-shell)", borderBottom: "1px solid var(--erp-border)", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--erp-shell-text)", letterSpacing: "-0.01em" }}>Comandera</span>
          <span style={{ fontSize: 12, background: pendientes.length > 0 ? "var(--erp-primary)" : "var(--erp-border)", color: pendientes.length > 0 ? "#fff" : "var(--erp-text-3)", borderRadius: 99, padding: "2px 8px", fontWeight: 700 }}>
            {pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      {/* Contenido */}
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
          const silPrep   = now < (silenciados[`${pedido.id}-prep`]    ?? 0);
          const silRetiro = now < (silenciados[`${pedido.id}-retiro`]  ?? 0);
          const silEntrega = now < (silenciados[`${pedido.id}-entrega`] ?? 0);

          return (
            <div key={pedido.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${pedido.pedidoAceptado ? "border-blue-300 bg-blue-100" : clases}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">
                  Pedido #{pedido.id} — {pedido.cliente}
                </h3>
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

        {/* Pedidos entregados (colapsable) */}
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

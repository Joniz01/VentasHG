"use client";

import { useEffect, useRef, useState } from "react";
import type { PedidoPendiente } from "@/lib/types";

type Estado = "PENDIENTE" | "PREPARAR" | "ENTREGAR";

type AlarmaInfo = {
  prepAck: boolean;
  prepProximoBeep: number | null;
  entregaAck: boolean;
  entregaProximoBeep: number | null;
};

const REPETIR_MS = 30_000;
const SILENCIAR_MS = 5 * 60_000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatHora(iso: string) {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function computeEstado(now: number, horaPreparacion: string, horaEntrega: string): Estado {
  const prep = new Date(horaPreparacion).getTime();
  const entrega = new Date(horaEntrega).getTime();
  if (now >= entrega) return "ENTREGAR";
  if (now >= prep) return "PREPARAR";
  return "PENDIENTE";
}

function playAlarma() {
  try {
    type WindowWithWebkitAudio = typeof window & { webkitAudioContext?: typeof AudioContext };
    const win = window as WindowWithWebkitAudio;
    const AudioContextClass = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.value = 0.3;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      const startTime = ctx.currentTime + i * 0.4;
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.25);
    }

    setTimeout(() => ctx.close(), 1500);
  } catch {
    // El navegador no soporta Web Audio API
  }
}

const ESTADO_LABELS: Record<Estado, string> = {
  PENDIENTE: "Pendiente",
  PREPARAR: "Preparar",
  ENTREGAR: "Entregar",
};

const ESTADO_CLASES: Record<Estado, string> = {
  PENDIENTE: "border-zinc-200 bg-white",
  PREPARAR: "border-yellow-300 bg-yellow-100",
  ENTREGAR: "border-pink-200 bg-pink-100",
};

export default function PedidosPendientesClient() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const alarmas = useRef<Map<number, AlarmaInfo>>(new Map());

  async function loadPedidos() {
    try {
      const res = await fetch("/api/pedidos-pendientes");
      const data = (await res.json()) as PedidoPendiente[];

      const idsActuales = new Set(data.map((p) => p.id));
      for (const id of alarmas.current.keys()) {
        if (!idsActuales.has(id)) alarmas.current.delete(id);
      }
      for (const pedido of data) {
        if (!alarmas.current.has(pedido.id)) {
          alarmas.current.set(pedido.id, {
            prepAck: false,
            prepProximoBeep: null,
            entregaAck: false,
            entregaProximoBeep: null,
          });
        }
      }

      setPedidos(data);
    } catch {
      setError("No se pudieron cargar los pedidos pendientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPedidos();
    const fetchInterval = setInterval(loadPedidos, 30_000);
    return () => clearInterval(fetchInterval);
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      const now = Date.now();
      let sonar = false;

      for (const pedido of pedidos) {
        const info = alarmas.current.get(pedido.id);
        if (!info) continue;
        const estado = computeEstado(now, pedido.horaPreparacion, pedido.horaEntrega);

        if (estado === "PREPARAR" && !info.prepAck) {
          if (info.prepProximoBeep === null) info.prepProximoBeep = now;
          if (now >= info.prepProximoBeep) {
            sonar = true;
            info.prepProximoBeep = now + REPETIR_MS;
          }
        }

        if (estado === "ENTREGAR" && !info.entregaAck) {
          if (info.entregaProximoBeep === null) info.entregaProximoBeep = now;
          if (now >= info.entregaProximoBeep) {
            sonar = true;
            info.entregaProximoBeep = now + REPETIR_MS;
          }
        }
      }

      if (sonar) playAlarma();

      setNow(now);
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [pedidos]);

  function silenciar(pedidoId: number, etapa: "prep" | "entrega") {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    const proximo = now + SILENCIAR_MS;
    if (etapa === "prep") {
      info.prepProximoBeep = proximo;
    } else {
      info.entregaProximoBeep = proximo;
    }
    setNow(now + 1);
  }

  function aceptarPreparacion(pedidoId: number) {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    info.prepAck = true;
    setNow(now + 1);
  }

  async function aceptarEntrega(pedidoId: number) {
    try {
      const res = await fetch(`/api/pedidos-pendientes/${pedidoId}`, { method: "PATCH" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar el pedido");
      }
      alarmas.current.delete(pedidoId);
      await loadPedidos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el pedido");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-zinc-500">Cargando...</div>}

      {!loading && pedidos.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No hay pedidos pendientes por entregar
        </div>
      )}

      {pedidos.map((pedido) => {
        const estado = computeEstado(now, pedido.horaPreparacion, pedido.horaEntrega);

        return (
          <div
            key={pedido.id}
            className={`flex flex-col gap-2 rounded-lg border p-4 ${ESTADO_CLASES[estado]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">
                Pedido #{pedido.id} — {pedido.cliente}
              </h3>
              <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold uppercase">
                {ESTADO_LABELS[estado]}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1 text-sm text-zinc-700 sm:grid-cols-2">
              <div>
                <span className="font-medium">Dirección: </span>
                {pedido.direccion ?? "-"}
              </div>
              <div>
                <span className="font-medium">Delivery asignado: </span>
                {pedido.deliveryAsignado ?? "-"}
              </div>
              <div>
                <span className="font-medium">Frito o Congelado: </span>
                {pedido.fritoCongelado}
              </div>
              <div>
                <span className="font-medium">Hora de preparación: </span>
                {formatHora(pedido.horaPreparacion)}
              </div>
              <div>
                <span className="font-medium">Hora de entrega: </span>
                {formatHora(pedido.horaEntrega)}
              </div>
            </div>

            <div className="text-sm text-zinc-700">
              <span className="font-medium">Productos: </span>
              {pedido.items
                .map(
                  (item) =>
                    `${item.nombreProducto}${item.extraNombre ? ` (${item.extraNombre})` : ""} x${item.cantidad}`
                )
                .join(", ")}
            </div>

            {estado === "PREPARAR" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => silenciar(pedido.id, "prep")}
                  className="rounded-md border border-zinc-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                >
                  Silenciar
                </button>
                <button
                  type="button"
                  onClick={() => aceptarPreparacion(pedido.id)}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Aceptar
                </button>
              </div>
            )}

            {estado === "ENTREGAR" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => silenciar(pedido.id, "entrega")}
                  className="rounded-md border border-zinc-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                >
                  Silenciar
                </button>
                <button
                  type="button"
                  onClick={() => aceptarEntrega(pedido.id)}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                >
                  Aceptar (entregado)
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

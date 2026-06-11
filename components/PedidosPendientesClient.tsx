"use client";

import { useEffect, useRef, useState } from "react";
import type { AlarmasConfig, PedidoPendiente } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT } from "@/lib/types";
import { reproducirAlarma } from "@/lib/alarmas";
import {
  computeEstadoPedido,
  ESTADO_PEDIDO_CLASES as ESTADO_CLASES,
  ESTADO_PEDIDO_LABELS as ESTADO_LABELS,
  formatHora,
} from "@/lib/pedidos";

type AlarmaInfo = {
  prepProximoBeep: number | null;
  entregaProximoBeep: number | null;
};

export default function PedidosPendientesClient() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [mostrarEntregados, setMostrarEntregados] = useState(false);
  const [silenciados, setSilenciados] = useState<Record<string, number>>({});

  const alarmas = useRef<Map<number, AlarmaInfo>>(new Map());
  const alarmasConfig = useRef<AlarmasConfig>(ALARMAS_CONFIG_DEFAULT);

  async function loadAlarmasConfig() {
    try {
      const res = await fetch("/api/alarmas-config");
      if (res.ok) {
        alarmasConfig.current = (await res.json()) as AlarmasConfig;
      }
    } catch {
      // Usar configuración por defecto si falla
    }
  }

  async function loadPedidos() {
    try {
      const res = await fetch("/api/pedidos-pendientes");
      const data = (await res.json()) as PedidoPendiente[];

      const idsPendientes = new Set(
        data.filter((p) => !p.pedidoEntregado).map((p) => p.id)
      );
      for (const id of alarmas.current.keys()) {
        if (!idsPendientes.has(id)) alarmas.current.delete(id);
      }
      for (const pedido of data) {
        if (!pedido.pedidoEntregado && !alarmas.current.has(pedido.id)) {
          alarmas.current.set(pedido.id, {
            prepProximoBeep: null,
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
    loadAlarmasConfig();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPedidos();
    const fetchInterval = setInterval(loadPedidos, 30_000);
    return () => clearInterval(fetchInterval);
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      const now = Date.now();

      for (const pedido of pedidos) {
        if (pedido.pedidoEntregado) continue;
        const info = alarmas.current.get(pedido.id);
        if (!info) continue;
        const estado = computeEstadoPedido(
          now,
          pedido.horaPreparacion,
          pedido.horaEntrega,
          pedido.pedidoEnviado
        );

        if (estado === "PREPARAR") {
          const config = alarmasConfig.current.preparacion;
          if (info.prepProximoBeep === null) info.prepProximoBeep = now;
          if (now >= info.prepProximoBeep) {
            reproducirAlarma(config, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            info.prepProximoBeep = now + config.repetirSegundos * 1000;
          }
        }

        if (estado === "ENTREGAR") {
          const config = alarmasConfig.current.entrega;
          if (info.entregaProximoBeep === null) info.entregaProximoBeep = now;
          if (now >= info.entregaProximoBeep) {
            reproducirAlarma(config, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            info.entregaProximoBeep = now + config.repetirSegundos * 1000;
          }
        }
      }

      setNow(now);
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [pedidos]);

  function silenciar(pedidoId: number, etapa: "prep" | "entrega") {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    const silenciarMs =
      (etapa === "prep"
        ? alarmasConfig.current.preparacion.silenciarMinutos
        : alarmasConfig.current.entrega.silenciarMinutos) * 60_000;
    const proximo = now + silenciarMs;
    if (etapa === "prep") {
      info.prepProximoBeep = proximo;
    } else {
      info.entregaProximoBeep = proximo;
    }
    setSilenciados((prev) => ({ ...prev, [`${pedidoId}-${etapa}`]: proximo }));
    setNow(now + 1);
  }

  async function aceptarPreparacion(pedidoId: number) {
    try {
      const res = await fetch(`/api/pedidos-pendientes/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enviado: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar el pedido");
      }
      await loadPedidos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el pedido");
    }
  }

  async function aceptarEntrega(pedidoId: number) {
    try {
      const res = await fetch(`/api/pedidos-pendientes/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entregado: true }),
      });
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

  async function volverAPendiente(pedidoId: number) {
    try {
      const res = await fetch(`/api/pedidos-pendientes/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entregado: false }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al actualizar el pedido");
      }
      await loadPedidos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el pedido");
    }
  }

  const pedidosPendientes = pedidos.filter((p) => !p.pedidoEntregado);
  const pedidosEntregados = pedidos.filter((p) => p.pedidoEntregado);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-zinc-500">Cargando...</div>}

      {!loading && pedidosPendientes.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
          No hay pedidos pendientes por entregar
        </div>
      )}

      {pedidosPendientes.map((pedido) => {
        const estado = computeEstadoPedido(
          now,
          pedido.horaPreparacion,
          pedido.horaEntrega,
          pedido.pedidoEnviado
        );

        return (
          <div
            key={pedido.id}
            className={`flex flex-col gap-2 rounded-lg border p-4 ${ESTADO_CLASES[estado]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">
                Pedido #{pedido.id} — {pedido.cliente}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-700">
                  <span className="font-medium">Hora de entrega: </span>
                  {formatHora(pedido.horaEntrega)}
                </span>
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold uppercase">
                  {ESTADO_LABELS[estado]}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-1 text-sm text-zinc-700 sm:grid-cols-2">
              <div>
                <span className="font-medium">Frito o Congelado: </span>
                {pedido.fritoCongelado}
              </div>
              <div>
                <span className="font-medium">Dirección: </span>
                {pedido.direccion ?? "-"}
              </div>
              <div>
                <span className="font-medium">Productos: </span>
                {pedido.items
                  .map(
                    (item) =>
                      `${item.nombreProducto}${item.extraNombre ? ` (${item.extraNombre})` : ""} x${item.cantidad}`
                  )
                  .join(", ")}
              </div>
              <div>
                <span className="font-medium">Delivery asignado: </span>
                {pedido.deliveryAsignado ?? "-"}
              </div>
              <div>
                <span className="font-medium">Hora de preparación: </span>
                {formatHora(pedido.horaPreparacion)}
              </div>
            </div>

            {estado === "PREPARAR" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => silenciar(pedido.id, "prep")}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    now < (silenciados[`${pedido.id}-prep`] ?? 0)
                      ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200"
                      : "border-zinc-400 bg-white hover:bg-zinc-100"
                  }`}
                >
                  {now < (silenciados[`${pedido.id}-prep`] ?? 0) ? "Silenciado" : "Silenciar"}
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
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    now < (silenciados[`${pedido.id}-entrega`] ?? 0)
                      ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200"
                      : "border-zinc-400 bg-white hover:bg-zinc-100"
                  }`}
                >
                  {now < (silenciados[`${pedido.id}-entrega`] ?? 0) ? "Silenciado" : "Silenciar"}
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

      {pedidosEntregados.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50">
          <button
            type="button"
            onClick={() => setMostrarEntregados((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-green-800"
          >
            <span>Pedidos entregados hoy ({pedidosEntregados.length})</span>
            <span>{mostrarEntregados ? "▲" : "▼"}</span>
          </button>

          {mostrarEntregados && (
            <div className="flex flex-col gap-2 border-t border-green-200 p-4">
              {pedidosEntregados.map((pedido) => (
                <div
                  key={pedido.id}
                  className="flex flex-col gap-2 rounded-lg border border-green-300 bg-green-100 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">
                      Pedido #{pedido.id} — {pedido.cliente}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-zinc-700">
                        <span className="font-medium">Hora de entrega: </span>
                        {formatHora(pedido.horaEntrega)}
                      </span>
                      <div className="flex flex-col items-stretch gap-1">
                        <span className="rounded-md border border-green-400 bg-white px-2 py-1 text-center text-xs font-semibold uppercase text-green-800">
                          Entregado
                        </span>
                        <button
                          type="button"
                          onClick={() => volverAPendiente(pedido.id)}
                          className="rounded-md border border-zinc-400 bg-white px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                        >
                          Volver a pendiente
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-sm text-zinc-700 sm:grid-cols-2">
                    <div>
                      <span className="font-medium">Frito o Congelado: </span>
                      {pedido.fritoCongelado}
                    </div>
                    <div>
                      <span className="font-medium">Dirección: </span>
                      {pedido.direccion ?? "-"}
                    </div>
                    <div>
                      <span className="font-medium">Productos: </span>
                      {pedido.items
                        .map(
                          (item) =>
                            `${item.nombreProducto}${item.extraNombre ? ` (${item.extraNombre})` : ""} x${item.cantidad}`
                        )
                        .join(", ")}
                    </div>
                    <div>
                      <span className="font-medium">Delivery asignado: </span>
                      {pedido.deliveryAsignado ?? "-"}
                    </div>
                    <div>
                      <span className="font-medium">Hora de preparación: </span>
                      {formatHora(pedido.horaPreparacion)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

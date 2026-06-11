"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AlarmasConfig, Motorizado, PedidoPendiente } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT } from "@/lib/types";
import { reproducirAlarma } from "@/lib/alarmas";
import {
  computeEstadoPedido,
  ESTADO_PEDIDO_CLASES,
  ESTADO_PEDIDO_LABELS,
  formatHora,
} from "@/lib/pedidos";
import DeliveryReporteClient from "@/components/DeliveryReporteClient";

type AlarmaInfo = {
  entregaProximoBeep: number | null;
};

const ALARMAS_HABILITADAS_KEY = "vhg_delivery_alarmas_habilitadas";

export default function DeliveryClient() {
  const router = useRouter();
  const [motorizado, setMotorizado] = useState<Motorizado | null>(null);
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [mostrarEntregados, setMostrarEntregados] = useState(false);
  const [silenciados, setSilenciados] = useState<Record<string, number>>({});
  const [alarmasHabilitadas, setAlarmasHabilitadas] = useState(true);
  const [tab, setTab] = useState<"pedidos" | "reporte">("pedidos");

  const alarmas = useRef<Map<number, AlarmaInfo>>(new Map());
  const alarmasConfig = useRef<AlarmasConfig>(ALARMAS_CONFIG_DEFAULT);

  useEffect(() => {
    const stored = localStorage.getItem(ALARMAS_HABILITADAS_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlarmasHabilitadas(stored !== "false");
  }, []);

  function toggleAlarmas(value: boolean) {
    setAlarmasHabilitadas(value);
    localStorage.setItem(ALARMAS_HABILITADAS_KEY, String(value));
  }

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

  async function loadMotorizado() {
    try {
      const res = await fetch("/api/delivery-session");
      if (res.ok) {
        setMotorizado((await res.json()) as Motorizado);
      }
    } catch {
      // ignorar
    }
  }

  async function loadPedidos() {
    try {
      const res = await fetch("/api/delivery-pedidos");
      const data = (await res.json()) as PedidoPendiente[];

      const idsPendientes = new Set(
        data.filter((p) => !p.pedidoEntregado).map((p) => p.id)
      );
      for (const id of alarmas.current.keys()) {
        if (!idsPendientes.has(id)) alarmas.current.delete(id);
      }
      for (const pedido of data) {
        if (!pedido.pedidoEntregado && !alarmas.current.has(pedido.id)) {
          alarmas.current.set(pedido.id, { entregaProximoBeep: null });
        }
      }

      setPedidos(data);
    } catch {
      setError("No se pudieron cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlarmasConfig();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMotorizado();
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

        if (estado === "ENTREGAR" && alarmasHabilitadas) {
          const config = alarmasConfig.current.entrega;
          if (info.entregaProximoBeep === null) info.entregaProximoBeep = now;
          if (now >= info.entregaProximoBeep) {
            reproducirAlarma(config, pedido.id, ESTADO_PEDIDO_LABELS[estado], pedido.fritoCongelado);
            info.entregaProximoBeep = now + config.repetirSegundos * 1000;
          }
        }
      }

      setNow(now);
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [pedidos, alarmasHabilitadas]);

  function silenciar(pedidoId: number) {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    const silenciarMs = alarmasConfig.current.entrega.silenciarMinutos * 60_000;
    const proximo = now + silenciarMs;
    info.entregaProximoBeep = proximo;
    setSilenciados((prev) => ({ ...prev, [pedidoId]: proximo }));
    setNow(now + 1);
  }

  async function marcarAceptado(pedidoId: number) {
    try {
      const res = await fetch(`/api/delivery-pedidos/${pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceptado: true }),
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

  async function marcarEntregado(pedidoId: number) {
    try {
      const res = await fetch(`/api/delivery-pedidos/${pedidoId}`, {
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

  async function handleLogout() {
    await fetch("/api/delivery-logout", { method: "POST" });
    router.refresh();
  }

  const pedidosPendientes = pedidos.filter((p) => !p.pedidoEntregado);
  const pedidosEntregados = pedidos.filter((p) => p.pedidoEntregado);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <p className="text-sm text-zinc-600">Motorizado</p>
          <p className="text-base font-semibold">
            {motorizado ? `${motorizado.nombre} ${motorizado.apellido ?? ""}`.trim() : "..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={alarmasHabilitadas}
              onChange={(e) => toggleAlarmas(e.target.checked)}
            />
            Habilitar alarmas
          </label>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("pedidos")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            tab === "pedidos"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          Pedidos
        </button>
        <button
          type="button"
          onClick={() => setTab("reporte")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            tab === "reporte"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          Reporte
        </button>
      </div>

      {tab === "reporte" && <DeliveryReporteClient />}

      {tab === "pedidos" && (
        <>
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {loading && <div className="text-sm text-zinc-500">Cargando...</div>}

          {!loading && pedidosPendientes.length === 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              No tienes pedidos asignados pendientes
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
                className={`flex flex-col gap-2 rounded-lg border p-4 ${ESTADO_PEDIDO_CLASES[estado]}`}
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
                      {ESTADO_PEDIDO_LABELS[estado]}
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
                    <span className="font-medium">Hora de preparación: </span>
                    {formatHora(pedido.horaPreparacion)}
                  </div>
                </div>

                {(estado === "ENVIADO" || estado === "ENTREGAR") && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => silenciar(pedido.id)}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                        now < (silenciados[pedido.id] ?? 0)
                          ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200"
                          : "border-zinc-400 bg-white hover:bg-zinc-100"
                      }`}
                    >
                      {now < (silenciados[pedido.id] ?? 0) ? "Silenciado" : "Silenciar"}
                    </button>
                    {pedido.pedidoAceptado ? (
                      <button
                        type="button"
                        onClick={() => marcarEntregado(pedido.id)}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                      >
                        Entregado
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => marcarAceptado(pedido.id)}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                      >
                        Tomar Pedido
                      </button>
                    )}
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
                          <span className="rounded-md border border-green-400 bg-white px-2 py-1 text-center text-xs font-semibold uppercase text-green-800">
                            Entregado
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
        </>
      )}
    </div>
  );
}

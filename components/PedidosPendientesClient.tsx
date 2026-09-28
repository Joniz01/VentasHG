"use client";

import { useEffect, useRef, useState } from "react";
import type { AlarmasConfig, PedidoPendiente } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT, METODO_PAGO_LABELS } from "@/lib/types";
import { reproducirAlarma } from "@/lib/alarmas";
import {
  computeEstadoPedido,
  ESTADO_PEDIDO_CLASES as ESTADO_CLASES,
  ESTADO_PEDIDO_LABELS as ESTADO_LABELS,
  formatHora,
} from "@/lib/pedidos";

type AlarmaInfo = {
  prepProximoBeep: number | null;
  retiroProximoBeep: number | null;
  entregaProximoBeep: number | null;
};

export default function PedidosPendientesClient() {
  const [pedidos, setPedidos] = useState<PedidoPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [mostrarEntregados, setMostrarEntregados] = useState(false);
  const [silenciados, setSilenciados] = useState<Record<string, number>>({});
  const [pagoModal, setPagoModal] = useState<{ pedidoId: number; cliente: string } | null>(null);
  const [pagoMetodo, setPagoMetodo] = useState("EFECTIVO_BS");
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoGuardando, setPagoGuardando] = useState(false);

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
            retiroProximoBeep: null,
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
          pedido.horaRetiro,
          pedido.horaEntrega
        );

        if (estado === "PREPARAR") {
          const config = alarmasConfig.current.preparacion;
          if (info.prepProximoBeep === null) info.prepProximoBeep = now;
          if (now >= info.prepProximoBeep) {
            reproducirAlarma(config, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            info.prepProximoBeep = now + config.repetirSegundos * 1000;
          }
        }

        if (estado === "RETIRO") {
          const config = alarmasConfig.current.retiro;
          if (info.retiroProximoBeep === null) info.retiroProximoBeep = now;
          if (now >= info.retiroProximoBeep) {
            reproducirAlarma(config, pedido.id, ESTADO_LABELS[estado], pedido.fritoCongelado);
            info.retiroProximoBeep = now + config.repetirSegundos * 1000;
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

  function silenciar(pedidoId: number, etapa: "prep" | "retiro" | "entrega") {
    const info = alarmas.current.get(pedidoId);
    if (!info) return;
    const silenciarMinutos =
      etapa === "prep"
        ? alarmasConfig.current.preparacion.silenciarMinutos
        : etapa === "retiro"
          ? alarmasConfig.current.retiro.silenciarMinutos
          : alarmasConfig.current.entrega.silenciarMinutos;
    const proximo = now + silenciarMinutos * 60_000;
    if (etapa === "prep") {
      info.prepProximoBeep = proximo;
    } else if (etapa === "retiro") {
      info.retiroProximoBeep = proximo;
    } else {
      info.entregaProximoBeep = proximo;
    }
    setSilenciados((prev) => ({ ...prev, [`${pedidoId}-${etapa}`]: proximo }));
    setNow(now + 1);
  }

  async function aceptarRetiro(pedidoId: number) {
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

  async function registrarPago() {
    if (!pagoModal || !pagoMonto || Number(pagoMonto) <= 0) return;
    setPagoGuardando(true);
    try {
      const res = await fetch(`/api/pedidos-pendientes/${pagoModal.pedidoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagos: [{ metodo: pagoMetodo, monto: Number(pagoMonto) }] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al registrar pago");
      }
      setPagoModal(null);
      setPagoMonto("");
      await loadPedidos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar pago");
    } finally {
      setPagoGuardando(false);
    }
  }

  const pedidosPendientes = pedidos.filter((p) => !p.pedidoEntregado);
  const pedidosEntregados = pedidos.filter((p) => p.pedidoEntregado);

  return (
    <div className="flex flex-col gap-4">
      {/* Modal Registrar Pago */}
      {pagoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-zinc-900">Registrar Pago</h3>
            <p className="mb-4 text-sm text-zinc-500">Pedido #{pagoModal.pedidoId} — {pagoModal.cliente}</p>
            <div className="mb-3 flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">Método de pago</label>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={pagoMetodo}
                onChange={(e) => setPagoMetodo(e.target.value)}
              >
                {Object.entries(METODO_PAGO_LABELS)
                  .filter(([k]) => k !== "CASHEA" && k !== "YUMMY" && k !== "CXC_DIRECTA")
                  .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="mb-4 flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">Monto</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="0.00"
                value={pagoMonto}
                onChange={(e) => setPagoMonto(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={registrarPago}
                disabled={pagoGuardando || !pagoMonto || Number(pagoMonto) <= 0}
                className="flex-1 rounded-md bg-zinc-900 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {pagoGuardando ? "Guardando…" : "Confirmar pago"}
              </button>
              <button
                type="button"
                onClick={() => { setPagoModal(null); setPagoMonto(""); }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
          pedido.horaRetiro,
          pedido.horaEntrega
        );

        return (
          <div
            key={pedido.id}
            className={`flex flex-col gap-2 rounded-lg border p-4 ${
              pedido.pedidoAceptado ? "border-blue-300 bg-blue-100" : ESTADO_CLASES[estado]
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">
                Pedido #{pedido.id} — {pedido.cliente}
                {pedido.mesa && <span className="ml-2 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{pedido.mesa}</span>}
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex flex-col text-sm text-zinc-700">
                  <span>
                    <span className="font-medium">Hora de entrega: </span>
                    {formatHora(pedido.horaEntrega)}
                  </span>
                  {(pedido.horaEntrega || pedido.fecha) && (
                    <span>
                      <span className="font-medium">Fecha: </span>
                      {(() => {
                        const d = pedido.horaEntrega ? new Date(pedido.horaEntrega).toLocaleDateString("en-CA", { timeZone: "America/Caracas" }) : pedido.fecha;
                        return d.slice(8,10) + "/" + d.slice(5,7) + "/" + d.slice(0,4);
                      })()}
                    </span>
                  )}
                </div>
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold uppercase">
                  {ESTADO_LABELS[estado]}
                </span>
                {pedido.pedidoAceptado && (
                  <span className="rounded-md border border-blue-400 bg-blue-100 px-2 py-1 text-xs font-semibold uppercase text-blue-800">
                    Aceptado por Motorizado{pedido.deliveryAsignado ? ` (${pedido.deliveryAsignado})` : ""}
                  </span>
                )}
                {pedido.pedidoEnviado && (
                  <span className="rounded-md border border-green-400 bg-green-100 px-2 py-1 text-xs font-semibold uppercase text-green-800">
                    Retirado
                  </span>
                )}
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
              <div>
                <span className="font-medium">Hora de retiro: </span>
                {pedido.horaRetiro ? formatHora(pedido.horaRetiro) : "-"}
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
              </div>
            )}

            {estado === "RETIRO" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => silenciar(pedido.id, "retiro")}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    now < (silenciados[`${pedido.id}-retiro`] ?? 0)
                      ? "border-yellow-300 bg-yellow-100 hover:bg-yellow-200"
                      : "border-zinc-400 bg-white hover:bg-zinc-100"
                  }`}
                >
                  {now < (silenciados[`${pedido.id}-retiro`] ?? 0) ? "Silenciado" : "Silenciar"}
                </button>
                {!pedido.pedidoEnviado && (
                  <button
                    type="button"
                    onClick={() => aceptarRetiro(pedido.id)}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
                  >
                    Aceptar (retirado)
                  </button>
                )}
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

            {pedido.cuentaPorCobrar && !pedido.pedidoEntregado && (
              <div className="flex items-center gap-2 border-t border-current/10 pt-2">
                <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                  Sin pago registrado
                </span>
                <button
                  type="button"
                  onClick={() => { setPagoModal({ pedidoId: pedido.id, cliente: pedido.cliente }); setPagoMetodo("EFECTIVO_BS"); setPagoMonto(""); }}
                  className="rounded-md border border-zinc-400 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
                >
                  💳 Registrar pago
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
                      <div className="flex flex-col text-sm text-zinc-700">
                        <span>
                          <span className="font-medium">Hora de entrega: </span>
                          {formatHora(pedido.horaEntrega)}
                        </span>
                        {pedido.fecha && (
                          <span>
                            <span className="font-medium">Fecha: </span>
                            {pedido.fecha.slice(8,10) + "/" + pedido.fecha.slice(5,7) + "/" + pedido.fecha.slice(0,4)}
                          </span>
                        )}
                      </div>
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

"use client";

import { useState } from "react";

function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

const METODOS_PAGO_CXC = [
  { value: "EFECTIVO_USD", label: "💵 Efectivo USD" },
  { value: "EFECTIVO_BS",  label: "🪙 Efectivo Bs" },
  { value: "TRANSFERENCIA", label: "🏦 Transferencia" },
  { value: "PUNTO_VENTA",  label: "💳 Punto de Venta" },
  { value: "PAGO_MOVIL",   label: "📱 Pago Móvil" },
  { value: "ZELLE",        label: "Z Zelle" },
];

type Props = {
  onConfirm: (fechaPago: string, metodoPago?: string) => void;
  onCancel: () => void;
  confirming?: boolean;
  showMetodoPago?: boolean;
};

export default function FechaPagoConfirm({ onConfirm, onCancel, confirming, showMetodoPago }: Props) {
  const [fecha, setFecha] = useState(hoyCaracas());
  const [metodo, setMetodo] = useState("EFECTIVO_USD");

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-zinc-300 bg-white p-2 text-left" style={{ minWidth: 200 }}>
      <label className="text-xs text-zinc-500">¿Cuándo entró el dinero?</label>
      <input
        type="date"
        autoFocus
        value={fecha}
        max={hoyCaracas()}
        onChange={(e) => setFecha(e.target.value)}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
      />
      {showMetodoPago && (
        <>
          <label className="text-xs text-zinc-500">Forma de pago</label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            {METODOS_PAGO_CXC.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </>
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onConfirm(fecha, showMetodoPago ? metodo : undefined)}
          disabled={confirming}
          className="flex-1 rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {confirming ? "..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

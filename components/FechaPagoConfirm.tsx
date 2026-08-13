"use client";

import { useState } from "react";
import { METODO_PAGO_LABELS, type MetodoPago } from "@/lib/types";

function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

// Formas de pago reales seleccionables al confirmar un cobro (excluye los
// métodos "virtuales" CASHEA/YUMMY/CXC_DIRECTA, que no son una forma de pago
// en sí sino el origen de la cuenta por cobrar).
export const METODOS_PAGO_COBRO: readonly MetodoPago[] = [
  "PUNTO_VENTA",
  "TRANSFERENCIA",
  "PAGO_MOVIL",
  "EFECTIVO_BS",
  "EFECTIVO_USD",
  "ZELLE",
];

type Props = {
  onConfirm: (fechaPago: string, metodoPago?: MetodoPago) => void;
  onCancel: () => void;
  confirming?: boolean;
  pedirMetodoPago?: boolean;
};

// Confirmación inline usada al marcar Cashea/Yummy/CxC Directa como pagado:
// pide la fecha en que realmente entró el dinero (por defecto hoy, editable a
// una fecha anterior si el operador lo registra tarde) y, cuando aplica
// (CxC Directa), la forma de pago con la que efectivamente se cobró.
export default function FechaPagoConfirm({ onConfirm, onCancel, confirming, pedirMetodoPago }: Props) {
  const [fecha, setFecha] = useState(hoyCaracas());
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(METODOS_PAGO_COBRO[0]);

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-zinc-300 bg-white p-2 text-left">
      <label className="text-xs text-zinc-500">¿Cuándo entró el dinero?</label>
      <input
        type="date"
        autoFocus
        value={fecha}
        max={hoyCaracas()}
        onChange={(e) => setFecha(e.target.value)}
        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
      />
      {pedirMetodoPago && (
        <>
          <label className="text-xs text-zinc-500">Forma de pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
          >
            {METODOS_PAGO_COBRO.map((m) => (
              <option key={m} value={m}>{METODO_PAGO_LABELS[m]}</option>
            ))}
          </select>
        </>
      )}
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onConfirm(fecha, pedirMetodoPago ? metodoPago : undefined)}
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

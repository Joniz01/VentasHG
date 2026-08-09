"use client";

import { useState } from "react";

function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

type Props = {
  onConfirm: (fechaPago: string) => void;
  onCancel: () => void;
  confirming?: boolean;
};

// Confirmación inline usada al marcar Cashea/Yummy como pagado: pide la
// fecha en que realmente entró el dinero (por defecto hoy, editable a una
// fecha anterior si el operador lo registra tarde).
export default function FechaPagoConfirm({ onConfirm, onCancel, confirming }: Props) {
  const [fecha, setFecha] = useState(hoyCaracas());

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
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onConfirm(fecha)}
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

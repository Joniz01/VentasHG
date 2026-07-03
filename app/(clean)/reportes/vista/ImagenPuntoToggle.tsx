"use client";

import { useState } from "react";

export default function ImagenPuntoToggle({ imagen }: { imagen: string }) {
  const [expandida, setExpandida] = useState(false);

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <button
        type="button"
        onClick={() => setExpandida((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        <span className="text-base leading-none">{expandida ? "◆" : "◇"}</span>
        {expandida ? "Ocultar imagen punto de venta" : "Ver imagen punto de venta"}
      </button>
      {expandida && (
        <img
          src={imagen}
          alt="Punto de venta"
          className="mt-3 max-h-96 w-full rounded-md object-contain"
        />
      )}
    </div>
  );
}

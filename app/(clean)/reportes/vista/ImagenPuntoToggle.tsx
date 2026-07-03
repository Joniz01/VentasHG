"use client";

import { useEffect, useState } from "react";

export default function ImagenPuntoToggle() {
  const [imagen, setImagen] = useState<string | null>(null);
  const [expandida, setExpandida] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("reporte_imagen_punto");
      if (stored) setImagen(stored);
    } catch {}
  }, []);

  if (!imagen) return null;

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <button
        type="button"
        onClick={() => setExpandida((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900"
      >
        <span className="text-base leading-none">{expandida ? "◆" : "◇"}</span>
        {expandida ? "Ocultar imagen punto de venta" : "Ver imagen punto de venta"}
      </button>
      {expandida && (
        <img
          src={imagen}
          alt="Punto de venta"
          className="mt-3 max-h-96 rounded-md object-contain"
        />
      )}
    </div>
  );
}

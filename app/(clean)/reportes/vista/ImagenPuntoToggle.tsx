"use client";

import { useState } from "react";

export default function ImagenPuntoToggle({ imagen }: { imagen: string }) {
  const [expandida, setExpandida] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
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
            onClick={() => setFullscreen(true)}
            className="mt-3 max-h-64 w-full rounded-md object-contain cursor-zoom-in"
            title="Click para ampliar"
          />
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setFullscreen(false)}
        >
          <img
            src={imagen}
            alt="Punto de venta ampliado"
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-zinc-300"
            onClick={() => setFullscreen(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

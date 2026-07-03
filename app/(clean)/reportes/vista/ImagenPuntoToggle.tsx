"use client";

import { useEffect, useRef, useState } from "react";

export default function ImagenPuntoToggle() {
  const [imagen, setImagen] = useState<string | null>(null);
  const [expandida, setExpandida] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("reporte_imagen_punto");
      if (stored) setImagen(stored);
    } catch {}
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setImagen(data);
      setExpandida(true);
      try { localStorage.setItem("reporte_imagen_punto", data); } catch {}
    };
    reader.readAsDataURL(file);
  }

  function handleToggle() {
    if (!imagen) {
      inputRef.current?.click();
    } else {
      setExpandida((v) => !v);
    }
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          <span className="text-base leading-none">{expandida ? "◆" : "◇"}</span>
          {imagen
            ? expandida ? "Ocultar imagen punto de venta" : "Ver imagen punto de venta"
            : "Cargar imagen punto de venta"}
        </button>
        {imagen && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-zinc-400 hover:text-zinc-600 underline"
          >
            cambiar
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {expandida && imagen && (
        <img
          src={imagen}
          alt="Punto de venta"
          className="mt-3 max-h-96 w-full rounded-md object-contain"
        />
      )}
    </div>
  );
}

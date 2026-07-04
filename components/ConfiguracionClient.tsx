"use client";

import { useEffect, useState, FormEvent } from "react";

type Config = {
  imagen_retencion_dias: string;
  modo_entrega_default: string;
  wink_costo_default: string;
};

export default function ConfiguracionClient() {
  const [config, setConfig] = useState<Config>({
    imagen_retencion_dias: "7",
    modo_entrega_default: "DELIVERY",
    wink_costo_default: "3",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((d) => { setConfig(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      setMensaje("Configuración guardada");
      setTimeout(() => setMensaje(null), 3000);
    } catch {
      setMensaje("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Cargando...</p>;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">
          Modo de entrega por defecto
        </label>
        <p className="text-xs text-zinc-500">
          Valor inicial del modo de entrega al registrar una venta nueva.
        </p>
        <select
          value={config.modo_entrega_default}
          onChange={(e) => setConfig({ ...config, modo_entrega_default: e.target.value })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm w-40"
        >
          <option value="DELIVERY">Delivery</option>
          <option value="LOCAL">Local</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">
          Costo por defecto Wink ($)
        </label>
        <p className="text-xs text-zinc-500">
          Precio predeterminado al seleccionar Wink como tipo de delivery.
        </p>
        <input
          type="number"
          step="0.01"
          min={0}
          value={config.wink_costo_default}
          onChange={(e) => setConfig({ ...config, wink_costo_default: e.target.value })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm w-24"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">
          Días de retención de imágenes (punto de venta)
        </label>
        <p className="text-xs text-zinc-500">
          Las imágenes del punto de venta se eliminan automáticamente después de este número de días.
        </p>
        <input
          type="number"
          min={1}
          max={90}
          value={config.imagen_retencion_dias}
          onChange={(e) => setConfig({ ...config, imagen_retencion_dias: e.target.value })}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm w-24"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        {mensaje && (
          <span className={`text-sm ${mensaje.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
            {mensaje}
          </span>
        )}
      </div>
    </form>
  );
}

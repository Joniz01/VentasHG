"use client";

import { useEffect, useState, FormEvent } from "react";

type Config = {
  imagen_retencion_dias: string;
  modo_entrega_default: string;
  wink_costo_default: string;
  cashea_porcentajes: string;
  cashea_porcentaje_default: string;
  cashea_dias: string;
  cashea_dias_default: string;
  ventas_modo_vista: string;
  ventas_orden_pasos: string;
  ventas_paso1_abierto: string;
  ventas_paso2_abierto: string;
  ventas_paso3_abierto: string;
  ventas_paso4_abierto: string;
};

export default function ConfiguracionClient() {
  const [config, setConfig] = useState<Config>({
    imagen_retencion_dias: "7",
    modo_entrega_default: "DELIVERY",
    wink_costo_default: "3",
    cashea_porcentajes: "40,50,60",
    cashea_porcentaje_default: "50",
    cashea_dias: "15,30",
    cashea_dias_default: "15",
    ventas_modo_vista: "clasico",
    ventas_orden_pasos: "entrega_primero",
    ventas_paso1_abierto: "true",
    ventas_paso2_abierto: "true",
    ventas_paso3_abierto: "true",
    ventas_paso4_abierto: "true",
  });
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");
  const [nuevoDias, setNuevoDias] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((d) => { setConfig((prev) => ({ ...prev, ...d })); setLoading(false); })
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

  const porcentajesArr = (config.cashea_porcentajes ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const diasArr = (config.cashea_dias ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  function addPorcentaje() {
    const val = nuevoPorcentaje.trim();
    if (!val || porcentajesArr.includes(val)) return;
    setConfig((prev) => ({ ...prev, cashea_porcentajes: [...porcentajesArr, val].join(",") }));
    setNuevoPorcentaje("");
  }

  function removePorcentaje(val: string) {
    const updated = porcentajesArr.filter((v) => v !== val);
    setConfig((prev) => ({
      ...prev,
      cashea_porcentajes: updated.join(","),
      cashea_porcentaje_default: prev.cashea_porcentaje_default === val ? (updated[0] ?? "") : prev.cashea_porcentaje_default,
    }));
  }

  function addDias() {
    const val = nuevoDias.trim();
    if (!val || diasArr.includes(val)) return;
    setConfig((prev) => ({ ...prev, cashea_dias: [...diasArr, val].join(",") }));
    setNuevoDias("");
  }

  function removeDias(val: string) {
    const updated = diasArr.filter((v) => v !== val);
    setConfig((prev) => ({
      ...prev,
      cashea_dias: updated.join(","),
      cashea_dias_default: prev.cashea_dias_default === val ? (updated[0] ?? "") : prev.cashea_dias_default,
    }));
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

      <div className="flex flex-col gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-black">C</span>
          Cashea
        </h3>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">% de cuota inicial (opciones)</label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {porcentajesArr.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full border border-yellow-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700">
                {v}%
                <button type="button" onClick={() => removePorcentaje(v)} className="text-red-500 hover:text-red-700 leading-none">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              min={1}
              max={99}
              value={nuevoPorcentaje}
              onChange={(e) => setNuevoPorcentaje(e.target.value)}
              placeholder="Ej: 40"
              className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button type="button" onClick={addPorcentaje} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100">Agregar</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">% por defecto</label>
          <select
            value={config.cashea_porcentaje_default}
            onChange={(e) => setConfig({ ...config, cashea_porcentaje_default: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm w-28"
          >
            {porcentajesArr.map((v) => (
              <option key={v} value={v}>{v}%</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Días de financiamiento (opciones)</label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {diasArr.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded-full border border-yellow-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700">
                {v} días
                <button type="button" onClick={() => removeDias(v)} className="text-red-500 hover:text-red-700 leading-none">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              min={1}
              value={nuevoDias}
              onChange={(e) => setNuevoDias(e.target.value)}
              placeholder="Ej: 45"
              className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
            />
            <button type="button" onClick={addDias} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100">Agregar</button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Días por defecto</label>
          <select
            value={config.cashea_dias_default}
            onChange={(e) => setConfig({ ...config, cashea_dias_default: e.target.value })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm w-28"
          >
            {diasArr.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Formulario de Ventas */}
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold text-zinc-800">Formulario de Ventas</h3>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Modo de vista</label>
          <p className="text-xs text-zinc-500">
            "Clásico" muestra todo expandido. "Pasos" divide el formulario en 4 secciones colapsables con navegación guiada. Cada usuario puede sobreescribir este default en su perfil.
          </p>
          <div className="flex gap-2 mt-1">
            {[{ val: "clasico", label: "Clásico" }, { val: "pasos", label: "Pasos" }].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setConfig({ ...config, ventas_modo_vista: val })}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  config.ventas_modo_vista === val
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Orden de pasos — siempre visible */}
        <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 mt-1">
          <label className="text-sm font-medium text-zinc-700">Orden de pasos (default global)</label>
          <p className="text-xs text-zinc-500 mb-1">Cada usuario puede cambiarlo en su perfil.</p>
          <div className="flex flex-col gap-1">
            {[
              { val: "default", label: "1 Productos · 2 Formas de pago · 3 Entrega · 4 Cliente" },
              { val: "entrega_primero", label: "1 Productos · 2 Entrega · 3 Formas de pago · 4 Cliente" },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setConfig({ ...config, ventas_orden_pasos: val })}
                className={`rounded border px-3 py-2 text-xs text-left font-medium ${
                  config.ventas_orden_pasos === val
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {config.ventas_modo_vista === "pasos" && (
          <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3 mt-1">
            <p className="text-xs text-zinc-500">Secciones abiertas por defecto en escritorio (en móvil siempre inician cerradas):</p>
            {[
              { key: "ventas_paso1_abierto", label: "1 — Productos del Pedido" },
              { key: "ventas_paso2_abierto", label: "2 — Formas de pago / Entrega (según orden)" },
              { key: "ventas_paso3_abierto", label: "3 — Entrega / Formas de pago (según orden)" },
              { key: "ventas_paso4_abierto", label: "4 — Datos del Cliente" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-zinc-700">{label}</span>
                <div className="flex gap-1.5">
                  {[{ val: "true", label: "Abierto" }, { val: "false", label: "Cerrado" }].map(({ val, label: lbl }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setConfig({ ...config, [key]: val })}
                      className={`rounded border px-2 py-0.5 text-xs font-medium ${
                        config[key as keyof Config] === val
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-300 hover:bg-zinc-100"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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

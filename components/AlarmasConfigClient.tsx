"use client";

import { useEffect, useState } from "react";
import {
  ALARMAS_CONFIG_DEFAULT,
  TIPOS_ALARMA,
  TONOS_PRESET,
  type AlarmaEtapaConfig,
  type AlarmasConfig,
} from "@/lib/types";
import { TONO_LABELS, TIPO_ALARMA_LABELS, reproducirAlarma } from "@/lib/alarmas";

const ETAPAS: { key: Exclude<keyof AlarmasConfig, "vencimientoHora" | "casheaVencimientoHora">; titulo: string; estadoLabel: string }[] = [
  { key: "preparacion", titulo: "Alarma de Preparación", estadoLabel: "Preparar" },
  { key: "retiro", titulo: "Alarma de Retiro de Pedido", estadoLabel: "Retirar" },
  { key: "entrega", titulo: "Alarma de Entrega", estadoLabel: "Entregar" },
];

const MAX_AUDIO_BYTES = 500 * 1024; // 500 KB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function AlarmasConfigClient() {
  const [config, setConfig] = useState<AlarmasConfig>(ALARMAS_CONFIG_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/alarmas-config");
        if (res.ok) {
          setConfig((await res.json()) as AlarmasConfig);
        }
      } catch {
        // se mantiene la configuración por defecto
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function updateEtapa(etapa: Exclude<keyof AlarmasConfig, "vencimientoHora" | "casheaVencimientoHora">, cambios: Partial<AlarmaEtapaConfig>) {
    setConfig((prev) => ({
      ...prev,
      [etapa]: { ...prev[etapa], ...cambios },
    }));
  }

  async function handleAudioChange(etapa: Exclude<keyof AlarmasConfig, "vencimientoHora" | "casheaVencimientoHora">, file: File | null) {
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      setError("El archivo de audio no debe superar 500 KB");
      return;
    }
    setError(null);
    const dataUrl = await fileToDataUrl(file);
    updateEtapa(etapa, { audioDataUrl: dataUrl, audioNombre: file.name });
  }

  function handleProbar(etapa: Exclude<keyof AlarmasConfig, "vencimientoHora" | "casheaVencimientoHora">) {
    const etapaConfig = config[etapa];
    const estadoLabel = ETAPAS.find((e) => e.key === etapa)?.estadoLabel ?? "Preparar";
    reproducirAlarma(etapaConfig, 7, estadoLabel, "Frito");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/alarmas-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        throw new Error("No se pudo guardar la configuración");
      }
      const data = (await res.json()) as AlarmasConfig;
      setConfig(data);
      setSuccess("Configuración guardada correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-zinc-500">Cargando...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">{success}</div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-800">Alerta de Cuentas por Cobrar Vencidas</h3>
        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label className="text-sm font-medium text-zinc-700">
            Hora de alerta diaria
          </label>
          <input
            type="time"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={config.vencimientoHora}
            onChange={(e) => setConfig((prev) => ({ ...prev, vencimientoHora: e.target.value }))}
          />
          <p className="text-xs text-zinc-500">
            Hora en la que se activará la alerta para las cuentas por cobrar con plazo vencido.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-800">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-black">C</span>
            Alerta de Pagos Cashea Vencidos
          </span>
        </h3>
        <div className="flex flex-col gap-1 sm:max-w-xs">
          <label className="text-sm font-medium text-zinc-700">
            Hora de alerta diaria
          </label>
          <input
            type="time"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={config.casheaVencimientoHora ?? "09:00"}
            onChange={(e) => setConfig((prev) => ({ ...prev, casheaVencimientoHora: e.target.value }))}
          />
          <p className="text-xs text-zinc-500">
            Hora en la que se activará la alerta para los pagos Cashea con fecha de vencimiento cumplida y sin liquidar.
          </p>
        </div>
      </div>

      {ETAPAS.map(({ key, titulo }) => {
        const etapaConfig = config[key];
        return (
          <div key={key} className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-800">{titulo}</h3>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Tipo de alarma</label>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={etapaConfig.tipo}
                onChange={(e) =>
                  updateEtapa(key, { tipo: e.target.value as AlarmaEtapaConfig["tipo"] })
                }
              >
                {TIPOS_ALARMA.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_ALARMA_LABELS[tipo]}
                  </option>
                ))}
              </select>
            </div>

            {etapaConfig.tipo === "tono" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Tono</label>
                <select
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={etapaConfig.tonoId}
                  onChange={(e) =>
                    updateEtapa(key, { tonoId: e.target.value as AlarmaEtapaConfig["tonoId"] })
                  }
                >
                  {TONOS_PRESET.map((tono) => (
                    <option key={tono} value={tono}>
                      {TONO_LABELS[tono]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {etapaConfig.tipo === "mp3" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Archivo de audio (mp3, máx. 500 KB)</label>
                <input
                  type="file"
                  accept="audio/*"
                  className="text-sm"
                  onChange={(e) => handleAudioChange(key, e.target.files?.[0] ?? null)}
                />
                {etapaConfig.audioNombre && (
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <span>Archivo actual: {etapaConfig.audioNombre}</span>
                    <button
                      type="button"
                      onClick={() => updateEtapa(key, { audioDataUrl: null, audioNombre: null })}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>
            )}

            {etapaConfig.tipo === "voz" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Mensaje de voz (opcional)</label>
                <textarea
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Si se deja vacío, se leerá: Pedido número {pedido}, estado {estado}, {fritoCongelado}"
                  value={etapaConfig.mensajeVoz}
                  onChange={(e) => updateEtapa(key, { mensajeVoz: e.target.value })}
                />
                <p className="text-xs text-zinc-500">
                  Variables disponibles: {"{pedido}"}, {"{estado}"}, {"{fritoCongelado}"}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Repetir cada (segundos)</label>
                <input
                  type="number"
                  min={5}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={etapaConfig.repetirSegundos}
                  onChange={(e) =>
                    updateEtapa(key, { repetirSegundos: Number(e.target.value) || 5 })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Silenciar por (minutos)</label>
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={etapaConfig.silenciarMinutos}
                  onChange={(e) =>
                    updateEtapa(key, { silenciarMinutos: Number(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleProbar(key)}
              className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
            >
              Probar alarma
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar configuración"}
      </button>
    </div>
  );
}

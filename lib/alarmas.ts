import type { AlarmaEtapaConfig, TipoAlarma, TonoPreset } from "@/lib/types";

export const TONO_LABELS: Record<TonoPreset, string> = {
  clasico: "Clásico (3 beeps)",
  campana: "Campana",
  urgente: "Urgente (rápido)",
  suave: "Suave (tono largo)",
};

export const TIPO_ALARMA_LABELS: Record<TipoAlarma, string> = {
  navegador: "Navegador (beep clásico)",
  tono: "Tono",
  mp3: "Audio (MP3)",
  voz: "Voz (lee la información del pedido)",
};

type WindowWithWebkitAudio = typeof window & { webkitAudioContext?: typeof AudioContext };

export function playTono(tonoId: TonoPreset) {
  try {
    const win = window as WindowWithWebkitAudio;
    const AudioContextClass = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const beep = (
      freq: number,
      start: number,
      duration: number,
      type: OscillatorType = "sine",
      gainValue = 0.3
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = freq;
      gain.gain.value = gainValue;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    };

    let totalDuration = 1.5;
    switch (tonoId) {
      case "campana":
        beep(1046, ctx.currentTime, 0.6, "triangle");
        beep(784, ctx.currentTime + 0.3, 0.6, "triangle");
        totalDuration = 1.2;
        break;
      case "urgente":
        for (let i = 0; i < 5; i++) beep(1200, ctx.currentTime + i * 0.18, 0.12, "square");
        totalDuration = 1.2;
        break;
      case "suave":
        beep(523, ctx.currentTime, 1.2, "sine", 0.2);
        totalDuration = 1.4;
        break;
      case "clasico":
      default:
        for (let i = 0; i < 3; i++) beep(880, ctx.currentTime + i * 0.4, 0.25, "sine");
        totalDuration = 1.5;
        break;
    }

    setTimeout(() => ctx.close(), totalDuration * 1000);
  } catch {
    // El navegador no soporta Web Audio API
  }
}

export function playAudioUrl(url: string) {
  try {
    const audio = new Audio(url);
    void audio.play();
  } catch {
    // El navegador no pudo reproducir el audio
  }
}

export function speak(texto: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = "es-ES";
    window.speechSynthesis.speak(utter);
  } catch {
    // El navegador no soporta síntesis de voz
  }
}

export function mensajeVozPedido(
  config: AlarmaEtapaConfig,
  pedidoId: number,
  estadoLabel: string,
  fritoCongelado: string
) {
  if (!config.mensajeVoz.trim()) {
    return `Pedido número ${pedidoId}, estado ${estadoLabel}, ${fritoCongelado}`;
  }
  return config.mensajeVoz
    .replace(/\{pedido\}/g, String(pedidoId))
    .replace(/\{estado\}/g, estadoLabel)
    .replace(/\{fritoCongelado\}/g, fritoCongelado);
}

export function reproducirAlarma(
  config: AlarmaEtapaConfig,
  pedidoId: number,
  estadoLabel: string,
  fritoCongelado: string
) {
  switch (config.tipo) {
    case "tono":
      playTono(config.tonoId);
      break;
    case "mp3":
      if (config.audioDataUrl) playAudioUrl(config.audioDataUrl);
      else playTono("clasico");
      break;
    case "voz":
      speak(mensajeVozPedido(config, pedidoId, estadoLabel, fritoCongelado));
      break;
    case "navegador":
    default:
      playTono("clasico");
      break;
  }
}

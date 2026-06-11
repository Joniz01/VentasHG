import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import {
  ALARMAS_CONFIG_DEFAULT,
  TIPOS_ALARMA,
  TONOS_PRESET,
  type AlarmaEtapaConfig,
  type AlarmasConfig,
} from "@/lib/types";

const CONFIG_KEY = "alarmas_config";

function normalizarEtapa(value: unknown): AlarmaEtapaConfig {
  const base = { ...ALARMA_ETAPA_DEFAULT_CLONE() };
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  if (typeof v.tipo === "string" && (TIPOS_ALARMA as readonly string[]).includes(v.tipo)) {
    base.tipo = v.tipo as AlarmaEtapaConfig["tipo"];
  }
  if (typeof v.tonoId === "string" && (TONOS_PRESET as readonly string[]).includes(v.tonoId)) {
    base.tonoId = v.tonoId as AlarmaEtapaConfig["tonoId"];
  }
  if (typeof v.audioDataUrl === "string" || v.audioDataUrl === null) {
    base.audioDataUrl = v.audioDataUrl as string | null;
  }
  if (typeof v.audioNombre === "string" || v.audioNombre === null) {
    base.audioNombre = v.audioNombre as string | null;
  }
  if (typeof v.mensajeVoz === "string") {
    base.mensajeVoz = v.mensajeVoz;
  }
  if (typeof v.repetirSegundos === "number" && v.repetirSegundos >= 5) {
    base.repetirSegundos = v.repetirSegundos;
  }
  if (typeof v.silenciarMinutos === "number" && v.silenciarMinutos >= 1) {
    base.silenciarMinutos = v.silenciarMinutos;
  }

  return base;
}

function ALARMA_ETAPA_DEFAULT_CLONE(): AlarmaEtapaConfig {
  return { ...ALARMAS_CONFIG_DEFAULT.preparacion };
}

export async function GET() {
  const result = await pool.query(`SELECT value FROM app_config WHERE key = $1`, [CONFIG_KEY]);

  if (!result.rows[0]) {
    return NextResponse.json(ALARMAS_CONFIG_DEFAULT);
  }

  try {
    const parsed = JSON.parse(result.rows[0].value) as Partial<AlarmasConfig>;
    const config: AlarmasConfig = {
      preparacion: normalizarEtapa(parsed.preparacion),
      entrega: normalizarEtapa(parsed.entrega),
    };
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(ALARMAS_CONFIG_DEFAULT);
  }
}

export async function PUT(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<AlarmasConfig>;

  const config: AlarmasConfig = {
    preparacion: normalizarEtapa(body.preparacion),
    entrega: normalizarEtapa(body.entrega),
  };

  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [CONFIG_KEY, JSON.stringify(config)]
  );

  return NextResponse.json(config);
}

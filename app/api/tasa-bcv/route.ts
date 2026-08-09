import { NextRequest, NextResponse } from "next/server";
import { obtenerTasaBcv, obtenerTasaBcvPorFecha } from "@/lib/bcv";
import { pool } from "@/lib/db";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function leerCache(fecha: string): Promise<{ tasa: number; fuente: string | null } | null> {
  try {
    const r = await pool.query(
      `SELECT tasa, fuente FROM tasas_bcv_historico WHERE fecha = $1`,
      [fecha]
    );
    if (!r.rowCount) return null;
    return { tasa: Number(r.rows[0].tasa), fuente: r.rows[0].fuente };
  } catch {
    return null; // tabla pendiente de migración 055
  }
}

async function guardarCache(fecha: string, tasa: number, fuente: string): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO tasas_bcv_historico (fecha, tasa, fuente) VALUES ($1, $2, $3)
       ON CONFLICT (fecha) DO UPDATE SET tasa = EXCLUDED.tasa, fuente = EXCLUDED.fuente`,
      [fecha, tasa, fuente]
    );
  } catch { /* tabla pendiente de migración 055 */ }
}

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const fecha = request.nextUrl.searchParams.get("fecha");

  // Sin fecha: comportamiento original (tasa vigente/más reciente)
  if (!fecha) {
    try {
      const resultado = await obtenerTasaBcv();
      if (resultado.fecha) await guardarCache(resultado.fecha, resultado.tasa, "live");
      return NextResponse.json(resultado);
    } catch (err) {
      return NextResponse.json(
        { error: "No se pudo consultar la tasa BCV", ...(debug && err instanceof Error ? { detalle: err.message } : {}) },
        { status: 502 }
      );
    }
  }

  if (!FECHA_RE.test(fecha)) {
    return NextResponse.json({ error: "Formato de fecha inválido (use YYYY-MM-DD)" }, { status: 400 });
  }

  // Con fecha: primero caché local, luego histórico externo
  const cacheado = await leerCache(fecha);
  if (cacheado) {
    return NextResponse.json({ tasa: cacheado.tasa, fecha, fromCache: true });
  }

  try {
    const resultado = await obtenerTasaBcvPorFecha(fecha);
    await guardarCache(fecha, resultado.tasa, "pydolarve-history");
    return NextResponse.json(resultado);
  } catch (err) {
    // Temporalmente siempre se incluye el detalle para diagnosticar el formato real de la API externa
    return NextResponse.json(
      { error: "No se pudo consultar la tasa BCV histórica", detalle: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

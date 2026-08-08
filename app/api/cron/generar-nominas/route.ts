import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { obtenerTasaBcv } from "@/lib/bcv";
import { generarPeriodoNomina, sugerirProximoRango } from "@/lib/nomina-periodos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hoyCaracas(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

// Invocado por Vercel Cron (ver vercel.json). Revisa las Nóminas en modo
// AUTOMATICO y genera el siguiente período si su fecha_hasta calculada ya
// llegó o pasó. Requiere CRON_SECRET configurado en Vercel si se define.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const hoy = hoyCaracas();
  const generados: { nominaId: number; nombre: string; periodoId: number }[] = [];
  const errores: { nominaId: number; nombre: string; error: string }[] = [];

  const nominasResult = await pool.query(
    `SELECT n.id, n.nombre, n.frecuencia,
            (SELECT MAX(fecha_hasta) FROM periodos_nomina WHERE nomina_id = n.id) AS ultima_fecha_hasta
     FROM nominas n
     WHERE n.activo = TRUE AND n.modo_generacion = 'AUTOMATICO'`
  );

  if (nominasResult.rows.length === 0) {
    return NextResponse.json({ generados, errores, mensaje: "Sin Nóminas en modo automático" });
  }

  let tasaDia: number;
  try {
    tasaDia = (await obtenerTasaBcv()).tasa;
  } catch {
    return NextResponse.json({ error: "No se pudo consultar la tasa BCV, se reintentará en la próxima corrida" }, { status: 502 });
  }

  for (const n of nominasResult.rows) {
    const ultimaFechaHasta = n.ultima_fecha_hasta
      ? (n.ultima_fecha_hasta instanceof Date ? n.ultima_fecha_hasta.toISOString().slice(0, 10) : String(n.ultima_fecha_hasta).slice(0, 10))
      : null;

    const { fechaDesde, fechaHasta } = sugerirProximoRango(n.frecuencia, ultimaFechaHasta, hoy);

    // Solo se genera si el período sugerido ya venció (evita crear períodos futuros de antemano)
    if (fechaHasta > hoy) continue;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const periodoId = await generarPeriodoNomina(client, {
        nominaId: n.id,
        fechaDesde,
        fechaHasta,
        tasaDia,
        createdBy: null,
      });
      await client.query("COMMIT");
      generados.push({ nominaId: n.id, nombre: n.nombre, periodoId });
    } catch (err) {
      await client.query("ROLLBACK");
      errores.push({ nominaId: n.id, nombre: n.nombre, error: err instanceof Error ? err.message : String(err) });
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ generados, errores });
}

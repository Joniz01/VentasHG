import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { CategoriaGasto, EstadoGasto, FrecuenciaRecurrencia, TipoGasto } from "@/lib/types";

const DIAS_FRECUENCIA: Record<FrecuenciaRecurrencia, number> = {
  SEMANAL: 7,
  QUINCENAL: 15,
  MENSUAL: 30,
};

function calcularProximoRecordatorio(fecha: string, frecuencia: FrecuenciaRecurrencia): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + DIAS_FRECUENCIA[frecuencia]);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mapGasto(r: Record<string, unknown>) {
  const montoBs = Number(r.monto_bs);
  const tasaDia = Number(r.tasa_dia);
  return {
    id: r.id,
    categoria: r.categoria,
    tipo: r.tipo,
    proveedor: r.proveedor,
    descripcion: r.descripcion,
    locacionId: r.locacion_id,
    locacionNombre: r.locacion_nombre,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10),
    montoBs,
    tasaDia,
    montoUsd: tasaDia > 0 ? montoBs / tasaDia : 0,
    estado: r.estado,
    pagadoAt: r.pagado_at,
    comprobanteUrl: r.comprobante_url,
    recurrente: r.recurrente,
    frecuencia: r.frecuencia,
    proximoRecordatorio: r.proximo_recordatorio,
    recordatorioVisto: r.recordatorio_visto,
    createdAt: r.created_at,
  };
}

// Lunes de la semana ISO a la que pertenece la fecha (para agrupar automáticamente)
function inicioSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function finSemana(inicio: string): string {
  const d = new Date(`${inicio}T00:00:00`);
  d.setDate(d.getDate() + 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const categoria = searchParams.get("categoria");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (categoria) { params.push(categoria); conditions.push(`g.categoria = $${params.length}`); }
  if (desde) { params.push(desde); conditions.push(`g.fecha >= $${params.length}`); }
  if (hasta) { params.push(hasta); conditions.push(`g.fecha <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT g.*, l.nombre AS locacion_nombre
     FROM gastos g
     LEFT JOIN locaciones l ON l.id = g.locacion_id
     ${where}
     ORDER BY g.fecha DESC, g.id DESC`,
    params
  );

  const gastos = result.rows.map(mapGasto);

  const semanasMap = new Map<string, typeof gastos>();
  for (const gasto of gastos) {
    const inicio = inicioSemana(gasto.fecha);
    if (!semanasMap.has(inicio)) semanasMap.set(inicio, []);
    semanasMap.get(inicio)!.push(gasto);
  }

  const semanas = Array.from(semanasMap.entries())
    .map(([inicio, items]) => ({
      desde: inicio,
      hasta: finSemana(inicio),
      gastos: items,
      totalBs: items.reduce((s, g) => s + g.montoBs, 0),
      totalUsd: items.reduce((s, g) => s + g.montoUsd, 0),
    }))
    .sort((a, b) => (a.desde < b.desde ? 1 : -1));

  return NextResponse.json({ semanas });
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as {
    categoria?: CategoriaGasto;
    tipo?: TipoGasto;
    proveedor?: string;
    descripcion?: string;
    locacionId?: number | null;
    fecha?: string;
    montoBs?: number;
    tasaDia?: number;
    estado?: EstadoGasto;
    comprobanteUrl?: string;
    recurrente?: boolean;
    frecuencia?: FrecuenciaRecurrencia | null;
  };

  if (!body.categoria || !body.tipo || !body.proveedor?.trim() || !body.fecha) {
    return NextResponse.json({ error: "Categoría, tipo, proveedor y fecha son obligatorios" }, { status: 400 });
  }

  if (body.recurrente && !body.frecuencia) {
    return NextResponse.json({ error: "Indica la frecuencia de recurrencia" }, { status: 400 });
  }

  const proximoRecordatorio =
    body.recurrente && body.frecuencia ? calcularProximoRecordatorio(body.fecha, body.frecuencia) : null;

  try {
    const result = await pool.query(
      `INSERT INTO gastos
        (categoria, tipo, proveedor, descripcion, locacion_id, fecha, monto_bs, tasa_dia, estado,
         pagado_at, comprobante_url, recurrente, frecuencia, proximo_recordatorio, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               CASE WHEN $9 = 'PAGADO' THEN now() ELSE NULL END,
               $10,$11,$12,$13,$14)
       RETURNING id`,
      [
        body.categoria,
        body.tipo,
        body.proveedor.trim(),
        body.descripcion?.trim() || null,
        body.locacionId || null,
        body.fecha,
        Number(body.montoBs) || 0,
        Number(body.tasaDia) || 0,
        body.estado || "PENDIENTE",
        body.comprobanteUrl?.trim() || null,
        Boolean(body.recurrente),
        body.recurrente ? body.frecuencia : null,
        proximoRecordatorio,
        sesion.id,
      ]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error al registrar el gasto" }, { status: 400 });
  }
}

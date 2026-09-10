import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DIAS_FRECUENCIA: Record<string, number> = { SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 };

function calcularProximoVencimiento(base: string, frecuencia: string): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + (DIAS_FRECUENCIA[frecuencia] ?? 30));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateStr(v: unknown): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function mapCP(r: Record<string, unknown>) {
  const montoBs = Number(r.monto_bs);
  const montoUsd = Number(r.monto_usd);
  const tasaDia = Number(r.tasa_dia);
  const montoOriginalUsd = r.monto_original_usd != null ? Number(r.monto_original_usd) : null;
  return {
    id: r.id,
    proveedor: r.proveedor,
    proveedorRif: r.proveedor_rif ?? null,
    numeroFactura: r.numero_factura ?? null,
    descripcion: r.descripcion ?? null,
    fechaEmision: toDateStr(r.fecha_emision),
    fechaVencimiento: toDateStr(r.fecha_vencimiento),
    montoBs,
    montoUsd,
    montoOriginalUsd,
    tasaDia,
    estado: r.estado,
    montoOriginalBs: r.monto_original_bs ? Number(r.monto_original_bs) : null,
    montoPagadoBs: Number(r.monto_pagado_bs ?? 0),
    pagadoAt: r.pagado_at ?? null,
    comprobanteUrl: r.comprobante_url ?? null,
    notas: r.notas ?? null,
    recurrente: Boolean(r.recurrente),
    frecuencia: r.frecuencia ?? null,
    proximoVencimiento: r.proximo_vencimiento ? toDateStr(r.proximo_vencimiento) : null,
    tipo: (r.tipo as string) ?? "gasto",
    createdAt: r.created_at,
  };
}

async function syncCompras(): Promise<void> {
  await pool.query(`
    INSERT INTO cuentas_pagar
      (proveedor, proveedor_rif, numero_factura, descripcion, fecha_emision,
       fecha_vencimiento, monto_bs, monto_usd, tasa_dia, estado, recurrente, tipo, created_by)
    SELECT
      c.proveedor_nombre,
      c.proveedor_rif,
      COALESCE(c.numero_factura, 'COMPRA-' || c.id),
      'Compra a crédito' || CASE WHEN c.observaciones IS NOT NULL THEN ' — ' || c.observaciones ELSE '' END,
      c.fecha,
      COALESCE(c.fecha_vencimiento_pago, c.fecha),
      COALESCE(SUM(ci.subtotal_bs), 0),
      CASE WHEN c.tasa_dia > 0
        THEN ROUND(COALESCE(SUM(ci.subtotal_bs), 0) / c.tasa_dia, 2)
        ELSE 0 END,
      c.tasa_dia,
      'PENDIENTE',
      false,
      'compra',
      c.created_by
    FROM compras c
    LEFT JOIN compra_items ci ON ci.compra_id = c.id
    WHERE c.estado = 'ACTIVA'
      AND NOT EXISTS (
        SELECT 1 FROM cuentas_pagar cp
        WHERE cp.numero_factura = COALESCE(c.numero_factura, 'COMPRA-' || c.id)
          AND cp.tipo = 'compra'
      )
    GROUP BY c.id, c.proveedor_nombre, c.proveedor_rif, c.numero_factura,
             c.observaciones, c.fecha, c.fecha_vencimiento_pago, c.tasa_dia, c.created_by
  `);
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Sincronizar compras activas que aún no tienen registro en CxP
  try { await syncCompras(); } catch { /* no bloquear si falla el sync */ }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const proveedor = searchParams.get("proveedor");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const soloRecurrente = searchParams.get("recurrente");
  const pagadoDesde = searchParams.get("pagadoDesde");
  const pagadoHasta = searchParams.get("pagadoHasta");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (estado) { params.push(estado); conditions.push(`cp.estado = $${params.length}`); }
  if (proveedor) { params.push(`%${proveedor}%`); conditions.push(`lower(cp.proveedor) LIKE lower($${params.length})`); }
  if (desde) { params.push(desde); conditions.push(`cp.fecha_vencimiento >= $${params.length}`); }
  if (hasta) { params.push(hasta); conditions.push(`cp.fecha_vencimiento <= $${params.length}`); }
  if (soloRecurrente === "true") { conditions.push(`cp.recurrente = TRUE`); }
  else if (soloRecurrente === "false") { conditions.push(`cp.recurrente = FALSE`); }
  if (pagadoDesde) { params.push(pagadoDesde); conditions.push(`cp.pagado_at::date >= $${params.length}`); }
  if (pagadoHasta) { params.push(pagadoHasta); conditions.push(`cp.pagado_at::date <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM cuentas_pagar cp ${where}`, params);
    const total = Number(countResult.rows[0]?.total ?? 0);
    const offset = (page - 1) * pageSize;
    const listParams = [...params, pageSize, offset];

    const result = await pool.query(
      `SELECT cp.* FROM cuentas_pagar cp
       ${where}
       ORDER BY cp.fecha_vencimiento ASC, cp.id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    const items = result.rows.map(mapCP);

    // Incluir nóminas pagadas cuando se está filtrando por rango de pago (tab Pagados)
    if (pagadoDesde && pagadoHasta) {
      try {
        const nResult = await pool.query(
          `SELECT
             'N' || pn.id AS id,
             n.nombre AS proveedor,
             NULL AS proveedor_rif,
             NULL AS numero_factura,
             n.nombre || ' · ' || TO_CHAR(pn.fecha_desde,'DD/MM') || '–' || TO_CHAR(pn.fecha_hasta,'DD/MM/YYYY') AS descripcion,
             pn.fecha_desde AS fecha_emision,
             pn.fecha_hasta AS fecha_vencimiento,
             COALESCE(SUM(e.salario_base_usd * pn.tasa_dia), 0) AS monto_bs,
             COALESCE(SUM(e.salario_base_usd), 0) AS monto_usd,
             COALESCE(SUM(e.salario_base_usd), 0) AS monto_original_usd,
             pn.tasa_dia,
             'PAGADO' AS estado,
             NULL AS monto_original_bs,
             0 AS monto_pagado_bs,
             MAX(np.pagado_at) AS pagado_at,
             NULL AS comprobante_url,
             NULL AS notas,
             false AS recurrente,
             NULL AS frecuencia,
             NULL AS proximo_vencimiento,
             'nomina' AS tipo,
             NULL AS created_at
           FROM periodos_nomina pn
           JOIN nominas n ON n.id = pn.nomina_id
           JOIN nomina_pagos np ON np.periodo_id = pn.id AND np.estado = 'PAGADO'
           JOIN empleados e ON e.id = np.empleado_id
           GROUP BY pn.id, n.nombre, pn.fecha_desde, pn.fecha_hasta, pn.tasa_dia
           HAVING MAX(np.pagado_at)::date BETWEEN $1 AND $2
           ORDER BY MAX(np.pagado_at) DESC`,
          [pagadoDesde, pagadoHasta]
        );
        for (const r of nResult.rows) items.push(mapCP(r as Record<string, unknown>));
      } catch { /* tabla nomina_pagos no disponible — skip */ }
    }

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error al obtener cuentas por pagar", detalle }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as {
    proveedor?: string;
    proveedorRif?: string;
    numeroFactura?: string;
    descripcion?: string;
    fechaEmision?: string;
    fechaVencimiento?: string;
    montoBs?: number;
    montoUsd?: number;
    tasaDia?: number;
    estado?: string;
    notas?: string;
    recurrente?: boolean;
    frecuencia?: string | null;
  };

  if (!body.proveedor?.trim() || !body.fechaEmision || !body.fechaVencimiento) {
    return NextResponse.json({ error: "Proveedor, fecha de emisión y fecha de vencimiento son obligatorios" }, { status: 400 });
  }
  if (body.recurrente && !body.frecuencia) {
    return NextResponse.json({ error: "Indica la frecuencia de recurrencia" }, { status: 400 });
  }

  const recurrente = Boolean(body.recurrente);
  const frecuencia = recurrente ? (body.frecuencia ?? null) : null;
  const proximoVencimiento = recurrente && frecuencia
    ? calcularProximoVencimiento(body.fechaVencimiento, frecuencia)
    : null;

  const montoUsdFinal = Number(body.montoUsd) || 0;
  try {
    let result;
    try {
      result = await pool.query(
        `INSERT INTO cuentas_pagar
          (proveedor, proveedor_rif, numero_factura, descripcion, fecha_emision, fecha_vencimiento,
           monto_bs, monto_usd, monto_original_usd, tasa_dia, estado, notas, recurrente, frecuencia, proximo_vencimiento, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          body.proveedor.trim(),
          body.proveedorRif?.trim() || null,
          body.numeroFactura?.trim() || null,
          body.descripcion?.trim() || null,
          body.fechaEmision,
          body.fechaVencimiento,
          Number(body.montoBs) || 0,
          montoUsdFinal,
          Number(body.tasaDia) || 0,
          body.estado || "PENDIENTE",
          body.notas?.trim() || null,
          recurrente,
          frecuencia,
          proximoVencimiento,
          sesion.id,
        ]
      );
    } catch {
      // monto_original_usd pendiente de migración — insertar sin ella
      result = await pool.query(
        `INSERT INTO cuentas_pagar
          (proveedor, proveedor_rif, numero_factura, descripcion, fecha_emision, fecha_vencimiento,
           monto_bs, monto_usd, tasa_dia, estado, notas, recurrente, frecuencia, proximo_vencimiento, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id`,
        [
          body.proveedor.trim(),
          body.proveedorRif?.trim() || null,
          body.numeroFactura?.trim() || null,
          body.descripcion?.trim() || null,
          body.fechaEmision,
          body.fechaVencimiento,
          Number(body.montoBs) || 0,
          montoUsdFinal,
          Number(body.tasaDia) || 0,
          body.estado || "PENDIENTE",
          body.notas?.trim() || null,
          recurrente,
          frecuencia,
          proximoVencimiento,
          sesion.id,
        ]
      );
    }
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error al registrar cuenta por pagar", detalle }, { status: 400 });
  }
}

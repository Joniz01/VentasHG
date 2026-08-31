import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function mapCP(r: Record<string, unknown>) {
  const montoBs = Number(r.monto_bs);
  const montoUsd = Number(r.monto_usd);
  const tasaDia = Number(r.tasa_dia);
  return {
    id: r.id,
    proveedor: r.proveedor,
    proveedorRif: r.proveedor_rif ?? null,
    numeroFactura: r.numero_factura ?? null,
    descripcion: r.descripcion ?? null,
    fechaEmision: r.fecha_emision instanceof Date ? r.fecha_emision.toISOString().slice(0, 10) : String(r.fecha_emision).slice(0, 10),
    fechaVencimiento: r.fecha_vencimiento instanceof Date ? r.fecha_vencimiento.toISOString().slice(0, 10) : String(r.fecha_vencimiento).slice(0, 10),
    montoBs,
    montoUsd,
    tasaDia,
    estado: r.estado,
    montoOriginalBs: r.monto_original_bs ? Number(r.monto_original_bs) : null,
    montoPagadoBs: Number(r.monto_pagado_bs ?? 0),
    pagadoAt: r.pagado_at ?? null,
    comprobanteUrl: r.comprobante_url ?? null,
    notas: r.notas ?? null,
    createdAt: r.created_at,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const proveedor = searchParams.get("proveedor");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (estado) { params.push(estado); conditions.push(`cp.estado = $${params.length}`); }
  if (proveedor) { params.push(`%${proveedor}%`); conditions.push(`lower(cp.proveedor) LIKE lower($${params.length})`); }
  if (desde) { params.push(desde); conditions.push(`cp.fecha_vencimiento >= $${params.length}`); }
  if (hasta) { params.push(hasta); conditions.push(`cp.fecha_vencimiento <= $${params.length}`); }

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

    return NextResponse.json({ items: result.rows.map(mapCP), total, page, pageSize });
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
  };

  if (!body.proveedor?.trim() || !body.fechaEmision || !body.fechaVencimiento) {
    return NextResponse.json({ error: "Proveedor, fecha de emisión y fecha de vencimiento son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO cuentas_pagar
        (proveedor, proveedor_rif, numero_factura, descripcion, fecha_emision, fecha_vencimiento,
         monto_bs, monto_usd, tasa_dia, estado, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        body.proveedor.trim(),
        body.proveedorRif?.trim() || null,
        body.numeroFactura?.trim() || null,
        body.descripcion?.trim() || null,
        body.fechaEmision,
        body.fechaVencimiento,
        Number(body.montoBs) || 0,
        Number(body.montoUsd) || 0,
        Number(body.tasaDia) || 0,
        body.estado || "PENDIENTE",
        body.notas?.trim() || null,
        sesion.id,
      ]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error al registrar cuenta por pagar", detalle }, { status: 400 });
  }
}

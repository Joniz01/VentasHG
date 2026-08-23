import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EstadoGasto, FrecuenciaRecurrencia, TipoGasto } from "@/lib/types";

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
    tipoGastoId: r.tipo_gasto_id,
    tipoGastoNombre: r.tipo_gasto_nombre,
    tipo: r.tipo,
    proveedor: r.proveedor,
    proveedorRif: r.proveedor_rif ?? null,
    proveedorTelefono: r.proveedor_telefono ?? null,
    proveedorDireccion: r.proveedor_direccion ?? null,
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
    numeroFactura: r.numero_factura ?? null,
    recurrente: r.recurrente,
    frecuencia: r.frecuencia,
    proximoRecordatorio: r.proximo_recordatorio,
    recordatorioVisto: r.recordatorio_visto,
    centroCostoId: r.centro_costo_id ?? null,
    centroCostoNombre: r.centro_costo_nombre ?? null,
    createdAt: r.created_at,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const proveedor = searchParams.get("proveedor");
  const tipoGastoId = searchParams.get("tipoGastoId");
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 10));

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (desde) { params.push(desde); conditions.push(`g.fecha >= $${params.length}`); }
  if (hasta) { params.push(hasta); conditions.push(`g.fecha <= $${params.length}`); }
  if (proveedor) { params.push(`%${proveedor}%`); conditions.push(`lower(g.proveedor) LIKE lower($${params.length})`); }
  if (tipoGastoId) { params.push(Number(tipoGastoId)); conditions.push(`g.tipo_gasto_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM gastos g ${where}`, params);
    const total = Number(countResult.rows[0]?.total ?? 0);

    const offset = (page - 1) * pageSize;
    const listParams = [...params, pageSize, offset];

    const result = await pool.query(
      `SELECT g.*, l.nombre AS locacion_nombre, tg.nombre AS tipo_gasto_nombre, cc.nombre AS centro_costo_nombre
       FROM gastos g
       LEFT JOIN locaciones l ON l.id = g.locacion_id
       LEFT JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id
       LEFT JOIN centros_costo cc ON cc.id = g.centro_costo_id
       ${where}
       ORDER BY g.fecha DESC, g.id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return NextResponse.json({
      items: result.rows.map(mapGasto),
      total,
      page,
      pageSize,
    });
  } catch {
    // Migración 034 pendiente de aplicar en la base de datos
    return NextResponse.json({ items: [], total: 0, page, pageSize });
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as {
    tipoGastoId?: number;
    tipo?: TipoGasto;
    proveedor?: string;
    proveedorRif?: string;
    proveedorTelefono?: string;
    proveedorDireccion?: string;
    descripcion?: string;
    locacionId?: number | null;
    fecha?: string;
    montoBs?: number;
    tasaDia?: number;
    estado?: EstadoGasto;
    comprobanteUrl?: string;
    numeroFactura?: string;
    recurrente?: boolean;
    frecuencia?: FrecuenciaRecurrencia | null;
    centroCostoId?: number | null;
  };

  if (!body.tipoGastoId || !body.tipo || !body.proveedor?.trim() || !body.fecha) {
    return NextResponse.json({ error: "Tipo de gasto, tipo, proveedor y fecha son obligatorios" }, { status: 400 });
  }

  if (body.recurrente && !body.frecuencia) {
    return NextResponse.json({ error: "Indica la frecuencia de recurrencia" }, { status: 400 });
  }

  const proximoRecordatorio =
    body.recurrente && body.frecuencia ? calcularProximoRecordatorio(body.fecha, body.frecuencia) : null;

  // La columna legada "categoria" (NOT NULL, CHECK IN ('MATERIA_PRIMA','OPERACION'))
  // sigue existiendo en la tabla real. "Gasto Materia Prima" fue desactivado del
  // catálogo de tipos de gasto, así que todo gasto nuevo es operativo.
  const categoriaLegado = "OPERACION";

  const valoresBase = [
    body.tipoGastoId,
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
  ];

  const datosProveedor = [
    body.proveedorRif?.trim() || null,
    body.proveedorTelefono?.trim() || null,
    body.proveedorDireccion?.trim() || null,
  ];

  const centroCostoId = body.centroCostoId ? Number(body.centroCostoId) : null;

  try {
    const result = await pool.query(
      `INSERT INTO gastos
        (tipo_gasto_id, tipo, proveedor, descripcion, locacion_id, fecha, monto_bs, tasa_dia, estado,
         pagado_at, comprobante_url, recurrente, frecuencia, proximo_recordatorio, created_by, numero_factura,
         proveedor_rif, proveedor_telefono, proveedor_direccion, categoria, centro_costo_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
               CASE WHEN $9 = 'PAGADO' THEN now() ELSE NULL END,
               $10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [...valoresBase, body.numeroFactura?.trim() || null, ...datosProveedor, categoriaLegado, centroCostoId]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch {
    // columnas proveedor_rif/telefono/direccion pendientes de migración 058 — insertar sin ellas
    try {
      const result = await pool.query(
        `INSERT INTO gastos
          (tipo_gasto_id, tipo, proveedor, descripcion, locacion_id, fecha, monto_bs, tasa_dia, estado,
           pagado_at, comprobante_url, recurrente, frecuencia, proximo_recordatorio, created_by, numero_factura, categoria)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                 CASE WHEN $9 = 'PAGADO' THEN now() ELSE NULL END,
                 $10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [...valoresBase, body.numeroFactura?.trim() || null, categoriaLegado]
      );
      return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
    } catch {
      // columna numero_factura pendiente de migración 057 — insertar sin ella
      try {
        const result = await pool.query(
          `INSERT INTO gastos
            (tipo_gasto_id, tipo, proveedor, descripcion, locacion_id, fecha, monto_bs, tasa_dia, estado,
             pagado_at, comprobante_url, recurrente, frecuencia, proximo_recordatorio, created_by, categoria)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                   CASE WHEN $9 = 'PAGADO' THEN now() ELSE NULL END,
                   $10,$11,$12,$13,$14,$15)
           RETURNING id`,
          [...valoresBase, categoriaLegado]
        );
        return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
      } catch (err3) {
        const detalle = err3 instanceof Error ? err3.message : String(err3);
        return NextResponse.json({ error: "Error al registrar el gasto", detalle }, { status: 400 });
      }
    }
  }
}

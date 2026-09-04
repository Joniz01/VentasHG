import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EstadoGasto, FrecuenciaRecurrencia, TipoGasto } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

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

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
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
    recordatorioVisto?: boolean;
    centroCostoId?: number | null;
  };

  if (!body.tipoGastoId || !body.tipo || !body.proveedor?.trim() || !body.fecha) {
    return NextResponse.json({ error: "Tipo de gasto, tipo, proveedor y fecha son obligatorios" }, { status: 400 });
  }

  const proximoRecordatorio =
    body.recurrente && body.frecuencia ? calcularProximoRecordatorio(body.fecha, body.frecuencia) : null;

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
    body.recordatorioVisto ?? false,
    id,
  ];

  const datosProveedor = [
    body.proveedorRif?.trim() || null,
    body.proveedorTelefono?.trim() || null,
    body.proveedorDireccion?.trim() || null,
  ];

  const centroCostoId = body.centroCostoId !== undefined ? (body.centroCostoId ? Number(body.centroCostoId) : null) : undefined;

  try {
    const result = await pool.query(
      `UPDATE gastos
       SET tipo_gasto_id = $1, tipo = $2, proveedor = $3, descripcion = $4, locacion_id = $5,
           fecha = $6, monto_bs = $7, tasa_dia = $8, estado = $9,
           pagado_at = CASE WHEN $9 = 'PAGADO' AND pagado_at IS NULL THEN now()
                            WHEN $9 != 'PAGADO' THEN NULL ELSE pagado_at END,
           comprobante_url = $10, recurrente = $11, frecuencia = $12, proximo_recordatorio = $13,
           recordatorio_visto = $14, numero_factura = $16,
           proveedor_rif = $17, proveedor_telefono = $18, proveedor_direccion = $19,
           centro_costo_id = $20
       WHERE id = $15
       RETURNING id`,
      [...valoresBase, body.numeroFactura?.trim() || null, ...datosProveedor, centroCostoId ?? null]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ id: Number(id) });
  } catch {
    // columnas proveedor_rif/telefono/direccion pendientes de migración 058 — actualizar sin ellas
    try {
      const result = await pool.query(
        `UPDATE gastos
         SET tipo_gasto_id = $1, tipo = $2, proveedor = $3, descripcion = $4, locacion_id = $5,
             fecha = $6, monto_bs = $7, tasa_dia = $8, estado = $9,
             pagado_at = CASE WHEN $9 = 'PAGADO' AND pagado_at IS NULL THEN now()
                              WHEN $9 != 'PAGADO' THEN NULL ELSE pagado_at END,
             comprobante_url = $10, recurrente = $11, frecuencia = $12, proximo_recordatorio = $13,
             recordatorio_visto = $14, numero_factura = $16
         WHERE id = $15
         RETURNING id`,
        [...valoresBase, body.numeroFactura?.trim() || null]
      );

      if (result.rowCount === 0) {
        return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
      }

      return NextResponse.json({ id: Number(id) });
    } catch {
      // columna numero_factura pendiente de migración 057 — actualizar sin ella
      try {
        const result = await pool.query(
          `UPDATE gastos
           SET tipo_gasto_id = $1, tipo = $2, proveedor = $3, descripcion = $4, locacion_id = $5,
               fecha = $6, monto_bs = $7, tasa_dia = $8, estado = $9,
               pagado_at = CASE WHEN $9 = 'PAGADO' AND pagado_at IS NULL THEN now()
                                WHEN $9 != 'PAGADO' THEN NULL ELSE pagado_at END,
               comprobante_url = $10, recurrente = $11, frecuencia = $12, proximo_recordatorio = $13,
               recordatorio_visto = $14
           WHERE id = $15
           RETURNING id`,
          valoresBase
        );

        if (result.rowCount === 0) {
          return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
        }

        return NextResponse.json({ id: Number(id) });
      } catch (err3) {
        const detalle = err3 instanceof Error ? err3.message : String(err3);
        return NextResponse.json({ error: "Error al actualizar el gasto", detalle }, { status: 400 });
      }
    }
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(`DELETE FROM gastos WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

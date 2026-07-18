import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { NominaIncidenciaConfigInput } from "@/lib/types";

type Params = { params: Promise<{ configId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { configId } = await params;
  const body = (await request.json()) as Partial<NominaIncidenciaConfigInput>;

  if (!body.tipoIncidenciaId || !body.frecuencia || !body.fechaEfectiva) {
    return NextResponse.json({ error: "Tipo de incidencia, frecuencia y fecha efectiva son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE nomina_incidencia_config
       SET tipo_incidencia_id = $1, frecuencia = $2, fecha_efectiva = $3, monto_usd = $4, monto_bs = $5, tasa_registro = $6
       WHERE id = $7
       RETURNING id`,
      [
        body.tipoIncidenciaId,
        body.frecuencia,
        body.fechaEfectiva,
        Number(body.montoUsd) || 0,
        Number(body.montoBs) || 0,
        Number(body.tasaRegistro) || 0,
        configId,
      ]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Incidencia no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al actualizar la incidencia" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { configId } = await params;
  const result = await pool.query(`DELETE FROM nomina_incidencia_config WHERE id = $1`, [configId]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Incidencia no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

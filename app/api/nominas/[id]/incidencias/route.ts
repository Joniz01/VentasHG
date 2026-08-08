import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { NominaIncidenciaConfigInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as Partial<NominaIncidenciaConfigInput>;

  if (!body.tipoIncidenciaId || !body.frecuencia || !body.fechaEfectiva) {
    return NextResponse.json({ error: "Tipo de incidencia, frecuencia y fecha efectiva son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO nomina_incidencia_config
        (nomina_id, tipo_incidencia_id, frecuencia, fecha_efectiva, monto_usd, monto_bs, tasa_registro)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        id,
        body.tipoIncidenciaId,
        body.frecuencia,
        body.fechaEfectiva,
        Number(body.montoUsd) || 0,
        Number(body.montoBs) || 0,
        Number(body.tasaRegistro) || 0,
      ]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error al agregar la incidencia" }, { status: 400 });
  }
}

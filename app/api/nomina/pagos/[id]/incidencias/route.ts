import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { tipoIncidenciaId?: number; montoBs?: number };

  if (!body.tipoIncidenciaId) {
    return NextResponse.json({ error: "Selecciona el tipo de incidencia" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO nomina_incidencias (nomina_pago_id, tipo_incidencia_id, monto_bs)
       VALUES ($1,$2,$3) RETURNING id`,
      [id, body.tipoIncidenciaId, Number(body.montoBs) || 0]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error al agregar la incidencia" }, { status: 400 });
  }
}

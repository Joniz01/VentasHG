import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { NominaInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as Partial<NominaInput>;

  if (!body.nombre?.trim() || !body.frecuencia) {
    return NextResponse.json({ error: "Nombre y frecuencia son obligatorios" }, { status: 400 });
  }

  const centroCostoId = body.centroCostoId ? Number(body.centroCostoId) : null;

  try {
    const result = await pool.query(
      `UPDATE nominas SET nombre = $1, tipo = $2, frecuencia = $3, modo_generacion = $4, activo = $5, centro_costo_id = $6 WHERE id = $7 RETURNING id`,
      [body.nombre.trim(), body.tipo || "NORMAL", body.frecuencia, body.modoGeneracion || "MANUAL", body.activo ?? true, centroCostoId, id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Nómina no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al actualizar la Nómina" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(`UPDATE nominas SET activo = FALSE WHERE id = $1 RETURNING id`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Nómina no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

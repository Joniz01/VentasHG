import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ configId: string }> };

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

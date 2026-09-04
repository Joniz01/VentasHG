import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as { pagoIds: number[] };
  if (!Array.isArray(body.pagoIds) || body.pagoIds.length === 0) {
    return NextResponse.json({ error: "pagoIds requerido" }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE nomina_pagos SET estado = 'PAGADO', pagado_at = NOW() WHERE id = ANY($1::int[])`,
      [body.pagoIds]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar los pagos" }, { status: 400 });
  }
}

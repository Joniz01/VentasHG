import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EstadoPeriodoNomina } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { estado?: EstadoPeriodoNomina };

  if (!body.estado) {
    return NextResponse.json({ error: "Estado es obligatorio" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE periodos_nomina SET estado = $1 WHERE id = $2 RETURNING id`,
    [body.estado, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(`DELETE FROM periodos_nomina WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

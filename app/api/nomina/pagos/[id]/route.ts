import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EstadoNominaPago } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { estado?: EstadoNominaPago; salarioBaseBs?: number };

  const cols: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, val: unknown) => { cols.push(`${col}=$${cols.length + 1}`); vals.push(val); };

  if (body.estado) {
    add("estado", body.estado);
    add("pagado_at", body.estado === "PAGADO" ? new Date() : null);
  }
  if (body.salarioBaseBs !== undefined) {
    add("salario_base_bs", Number(body.salarioBaseBs) || 0);
  }

  if (!cols.length) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  vals.push(id);
  const result = await pool.query(
    `UPDATE nomina_pagos SET ${cols.join(",")} WHERE id = $${vals.length} RETURNING id`,
    vals
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

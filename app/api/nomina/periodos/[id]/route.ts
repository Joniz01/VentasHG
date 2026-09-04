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

  // Bloquear eliminación si ya hay pagos marcados como PAGADO
  const pagadosResult = await pool.query(
    `SELECT COUNT(*) AS total FROM nomina_pagos WHERE periodo_id = $1 AND estado = 'PAGADO'`,
    [id]
  ).catch(() => ({ rows: [{ total: "0" }] }));

  if (Number(pagadosResult.rows[0]?.total) > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar: el período tiene pagos ya marcados como PAGADO" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Eliminar incidencias → pagos → período en orden (nomina_pago_id es la FK real)
    await client.query(
      `DELETE FROM nomina_incidencias WHERE nomina_pago_id IN (SELECT id FROM nomina_pagos WHERE periodo_id = $1)`,
      [id]
    );
    await client.query(`DELETE FROM nomina_pagos WHERE periodo_id = $1`, [id]);
    const result = await client.query(`DELETE FROM periodos_nomina WHERE id = $1`, [id]);
    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Error al eliminar: ${msg}` }, { status: 500 });
  } finally {
    client.release();
  }
}

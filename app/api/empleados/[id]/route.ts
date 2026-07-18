import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EmpleadoInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as Partial<EmpleadoInput>;

  if (!body.nombre?.trim() || !body.tipoPago) {
    return NextResponse.json({ error: "Nombre y tipo de pago son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE empleados
       SET nombre = $1, cargo = $2, locacion_id = $3, tipo_pago = $4, salario_base_bs = $5,
           fecha_ingreso = $6, activo = $7
       WHERE id = $8
       RETURNING id`,
      [
        body.nombre.trim(),
        body.cargo?.trim() || null,
        body.locacionId || null,
        body.tipoPago,
        Number(body.salarioBaseBs) || 0,
        body.fechaIngreso || null,
        body.activo ?? true,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al actualizar el empleado" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await pool.query(`UPDATE empleados SET activo = FALSE WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al desactivar el empleado" }, { status: 400 });
  }
}

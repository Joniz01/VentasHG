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

  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("SAVEPOINT sp_emp_put");
    let result: { rowCount: number | null; rows: { id: number }[] };
    try {
      result = await client.query(
        `UPDATE empleados
         SET nombre = $1, apellido = $2, cedula = $3, fecha_nacimiento = $4, sexo = $5, cargo = $6, cargo_id = $7, locacion_id = $8,
             salario_base_usd = $9, salario_base_bs = $10, tasa_registro = $11,
             fecha_ingreso = $12, activo = $13, estado_civil = $14
         WHERE id = $15
         RETURNING id`,
        [
          body.nombre.trim(),
          body.apellido?.trim() || null,
          body.cedula?.trim() || null,
          body.fechaNacimiento || null,
          body.sexo || null,
          body.cargo?.trim() || null,
          body.cargoId || null,
          body.locacionId || null,
          Number(body.salarioBaseUsd) || 0,
          Number(body.salarioBaseBs) || 0,
          Number(body.tasaRegistro) || 0,
          body.fechaIngreso || null,
          body.activo ?? true,
          body.estadoCivil || null,
          id,
        ]
      );
    } catch {
      // Migración 067/068 pendiente — actualizar sin apellido ni cargo_id
      await client.query("ROLLBACK TO sp_emp_put");
      await client.query("SAVEPOINT sp_emp_put2");
      try {
        result = await client.query(
          `UPDATE empleados
           SET nombre = $1, apellido = $2, cedula = $3, fecha_nacimiento = $4, sexo = $5, cargo = $6, locacion_id = $7,
               salario_base_usd = $8, salario_base_bs = $9, tasa_registro = $10,
               fecha_ingreso = $11, activo = $12
           WHERE id = $13
           RETURNING id`,
          [
            body.nombre.trim(),
            body.apellido?.trim() || null,
            body.cedula?.trim() || null,
            body.fechaNacimiento || null,
            body.sexo || null,
            body.cargo?.trim() || null,
            body.locacionId || null,
            Number(body.salarioBaseUsd) || 0,
            Number(body.salarioBaseBs) || 0,
            Number(body.tasaRegistro) || 0,
            body.fechaIngreso || null,
            body.activo ?? true,
            id,
          ]
        );
      } catch {
        await client.query("ROLLBACK TO sp_emp_put2");
        result = await client.query(
          `UPDATE empleados
           SET nombre = $1, cedula = $2, fecha_nacimiento = $3, sexo = $4, cargo = $5, locacion_id = $6,
               salario_base_usd = $7, salario_base_bs = $8, tasa_registro = $9,
               fecha_ingreso = $10, activo = $11
           WHERE id = $12
           RETURNING id`,
          [
            body.nombre.trim(),
            body.cedula?.trim() || null,
            body.fechaNacimiento || null,
            body.sexo || null,
            body.cargo?.trim() || null,
            body.locacionId || null,
            Number(body.salarioBaseUsd) || 0,
            Number(body.salarioBaseBs) || 0,
            Number(body.tasaRegistro) || 0,
            body.fechaIngreso || null,
            body.activo ?? true,
            id,
          ]
        );
      }
    }

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    await client.query(`DELETE FROM empleado_nominas WHERE empleado_id = $1`, [id]);
    for (const nominaId of body.nominaIds ?? []) {
      await client.query(
        `INSERT INTO empleado_nominas (empleado_id, nomina_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, nominaId]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Error al actualizar el empleado" }, { status: 400 });
  } finally {
    client.release();
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

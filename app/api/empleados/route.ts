import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EmpleadoInput } from "@/lib/types";

function mapEmpleado(r: Record<string, unknown>, nominasRows: Record<string, unknown>[]) {
  const asignadas = nominasRows.filter((n) => n.empleado_id === r.id);
  return {
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido ?? null,
    cedula: r.cedula ?? null,
    fechaNacimiento: r.fecha_nacimiento
      ? (r.fecha_nacimiento instanceof Date ? r.fecha_nacimiento.toISOString().slice(0, 10) : String(r.fecha_nacimiento).slice(0, 10))
      : null,
    sexo: r.sexo ?? null,
    cargo: r.cargo,
    cargoId: r.cargo_id ?? null,
    locacionId: r.locacion_id,
    locacionNombre: r.locacion_nombre,
    nominaIds: asignadas.map((n) => n.nomina_id),
    nominaNombres: asignadas.map((n) => n.nomina_nombre),
    salarioBaseUsd: Number(r.salario_base_usd ?? 0),
    salarioBaseBs: Number(r.salario_base_bs),
    tasaRegistro: Number(r.tasa_registro ?? 0),
    fechaIngreso: r.fecha_ingreso
      ? (r.fecha_ingreso instanceof Date ? r.fecha_ingreso.toISOString().slice(0, 10) : String(r.fecha_ingreso).slice(0, 10))
      : null,
    activo: r.activo,
    createdAt: r.created_at,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const soloActivos = searchParams.get("activo") !== "false";

  try {
    const result = await pool.query(
      `SELECT e.*, l.nombre AS locacion_nombre
       FROM empleados e
       LEFT JOIN locaciones l ON l.id = e.locacion_id
       ${soloActivos ? "WHERE e.activo = TRUE" : ""}
       ORDER BY e.nombre ASC`
    );
    const empleadoIds = result.rows.map((r) => r.id);
    const nominasResult = empleadoIds.length
      ? await pool.query(
          `SELECT en.empleado_id, en.nomina_id, n.nombre AS nomina_nombre
           FROM empleado_nominas en
           JOIN nominas n ON n.id = en.nomina_id
           WHERE en.empleado_id = ANY($1::int[])`,
          [empleadoIds]
        ).catch(() => ({ rows: [] }))
      : { rows: [] };
    return NextResponse.json(result.rows.map((r) => mapEmpleado(r, nominasResult.rows)));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<EmpleadoInput>;

  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("SAVEPOINT sp_emp");
    let result: { rows: { id: number }[] };
    try {
      result = await client.query(
        `INSERT INTO empleados
          (nombre, apellido, cedula, fecha_nacimiento, sexo, cargo, cargo_id, locacion_id,
           salario_base_usd, salario_base_bs, tasa_registro, fecha_ingreso, activo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
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
        ]
      );
    } catch {
      // Migración 067/068 pendiente — insertar sin apellido ni cargo_id
      await client.query("ROLLBACK TO sp_emp");
      await client.query("SAVEPOINT sp_emp2");
      try {
        result = await client.query(
          `INSERT INTO empleados
            (nombre, apellido, cedula, fecha_nacimiento, sexo, cargo, locacion_id,
             salario_base_usd, salario_base_bs, tasa_registro, fecha_ingreso, activo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
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
          ]
        );
      } catch {
        await client.query("ROLLBACK TO sp_emp2");
        result = await client.query(
          `INSERT INTO empleados
            (nombre, cedula, fecha_nacimiento, sexo, cargo, locacion_id,
             salario_base_usd, salario_base_bs, tasa_registro, fecha_ingreso, activo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
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
          ]
        );
      }
    }
    const empleadoId = result.rows[0].id;

    for (const nominaId of body.nominaIds ?? []) {
      await client.query(
        `INSERT INTO empleado_nominas (empleado_id, nomina_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [empleadoId, nominaId]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ id: empleadoId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Error al registrar el empleado" }, { status: 400 });
  } finally {
    client.release();
  }
}

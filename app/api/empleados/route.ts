import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { EmpleadoInput } from "@/lib/types";

function mapEmpleado(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    cargo: r.cargo,
    locacionId: r.locacion_id,
    locacionNombre: r.locacion_nombre,
    tipoPago: r.tipo_pago,
    salarioBaseBs: Number(r.salario_base_bs),
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
    return NextResponse.json(result.rows.map(mapEmpleado));
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

  if (!body.nombre?.trim() || !body.tipoPago) {
    return NextResponse.json({ error: "Nombre y tipo de pago son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO empleados (nombre, cargo, locacion_id, tipo_pago, salario_base_bs, fecha_ingreso, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        body.nombre.trim(),
        body.cargo?.trim() || null,
        body.locacionId || null,
        body.tipoPago,
        Number(body.salarioBaseBs) || 0,
        body.fechaIngreso || null,
        body.activo ?? true,
      ]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error al registrar el empleado" }, { status: 400 });
  }
}

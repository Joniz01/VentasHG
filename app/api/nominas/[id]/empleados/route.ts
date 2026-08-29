import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — lista empleados activos con flag si están asignados a esta nómina
export async function GET(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const result = await pool.query(
    `SELECT e.id, CONCAT(e.nombre, CASE WHEN e.apellido IS NOT NULL THEN ' ' || e.apellido ELSE '' END) AS nombre_completo,
            e.cedula, e.salario_base_usd,
            EXISTS(SELECT 1 FROM empleado_nominas en WHERE en.empleado_id = e.id AND en.nomina_id = $1) AS asignado
     FROM empleados e
     WHERE e.activo = TRUE
     ORDER BY e.nombre ASC`,
    [id]
  );

  return NextResponse.json(
    result.rows.map((r) => ({
      id: Number(r.id),
      nombre: String(r.nombre_completo),
      cedula: r.cedula ?? null,
      salarioBaseUsd: Number(r.salario_base_usd ?? 0),
      asignado: Boolean(r.asignado),
    }))
  );
}

// POST — sincroniza la lista de empleados para esta nómina
// Body: { empleadoIds: number[] }
// Agrega los que no están y quita los que sobran, sin tocar otras nóminas del empleado
export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const nominaId = Number(id);
  const body = (await request.json()) as { empleadoIds: number[] };
  const nuevosIds: number[] = Array.isArray(body.empleadoIds) ? body.empleadoIds.map(Number) : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Quitar los que ya no deben estar
    if (nuevosIds.length > 0) {
      await client.query(
        `DELETE FROM empleado_nominas WHERE nomina_id = $1 AND empleado_id <> ALL($2::int[])`,
        [nominaId, nuevosIds]
      );
    } else {
      await client.query(`DELETE FROM empleado_nominas WHERE nomina_id = $1`, [nominaId]);
    }

    // Insertar los nuevos (ON CONFLICT DO NOTHING para no duplicar)
    for (const eid of nuevosIds) {
      await client.query(
        `INSERT INTO empleado_nominas (empleado_id, nomina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [eid, nominaId]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, total: nuevosIds.length });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error al guardar asignaciones", detalle: msg }, { status: 400 });
  } finally {
    client.release();
  }
}

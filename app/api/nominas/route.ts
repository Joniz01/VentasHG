import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { NominaInput } from "@/lib/types";

function mapIncidenciaConfig(r: Record<string, unknown>) {
  return {
    id: r.id,
    nominaId: r.nomina_id,
    tipoIncidenciaId: r.tipo_incidencia_id,
    tipoIncidenciaNombre: r.tipo_incidencia_nombre,
    frecuencia: r.frecuencia,
    fechaEfectiva: r.fecha_efectiva instanceof Date ? r.fecha_efectiva.toISOString().slice(0, 10) : String(r.fecha_efectiva).slice(0, 10),
    montoUsd: Number(r.monto_usd),
    montoBs: Number(r.monto_bs),
    tasaRegistro: Number(r.tasa_registro),
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const nominasResult = await pool.query(
      `SELECT n.*, COALESCE(en.total, 0) AS empleados_asignados, up.fecha_hasta AS ultimo_periodo_fecha_hasta
       FROM nominas n
       LEFT JOIN (
         SELECT nomina_id, COUNT(*) AS total FROM empleado_nominas GROUP BY nomina_id
       ) en ON en.nomina_id = n.id
       LEFT JOIN (
         SELECT DISTINCT ON (nomina_id) nomina_id, fecha_hasta
         FROM periodos_nomina
         ORDER BY nomina_id, fecha_hasta DESC
       ) up ON up.nomina_id = n.id
       WHERE n.activo = TRUE
       ORDER BY n.nombre ASC`
    );
    const nominaIds = nominasResult.rows.map((r) => r.id);

    const incidenciasResult = nominaIds.length
      ? await pool.query(
          `SELECT nic.*, ti.nombre AS tipo_incidencia_nombre
           FROM nomina_incidencia_config nic
           JOIN tipos_incidencia ti ON ti.id = nic.tipo_incidencia_id
           WHERE nic.nomina_id = ANY($1::int[])
           ORDER BY nic.fecha_efectiva ASC`,
          [nominaIds]
        )
      : { rows: [] };

    const nominas = nominasResult.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      tipo: r.tipo,
      frecuencia: r.frecuencia,
      modoGeneracion: r.modo_generacion ?? "MANUAL",
      activo: r.activo,
      empleadosAsignados: Number(r.empleados_asignados),
      incidenciasConfig: incidenciasResult.rows
        .filter((i) => i.nomina_id === r.id)
        .map(mapIncidenciaConfig),
      ultimoPeriodoFechaHasta: r.ultimo_periodo_fecha_hasta
        ? (r.ultimo_periodo_fecha_hasta instanceof Date ? r.ultimo_periodo_fecha_hasta.toISOString().slice(0, 10) : String(r.ultimo_periodo_fecha_hasta).slice(0, 10))
        : null,
      createdAt: r.created_at,
    }));

    return NextResponse.json(nominas);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<NominaInput>;

  if (!body.nombre?.trim() || !body.frecuencia) {
    return NextResponse.json({ error: "Nombre y frecuencia son obligatorios" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO nominas (nombre, tipo, frecuencia, modo_generacion, activo) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [body.nombre.trim(), body.tipo || "NORMAL", body.frecuencia, body.modoGeneracion || "MANUAL", body.activo ?? true]
    );
    const nominaId = result.rows[0].id;

    for (const inc of body.incidencias ?? []) {
      await client.query(
        `INSERT INTO nomina_incidencia_config
          (nomina_id, tipo_incidencia_id, frecuencia, fecha_efectiva, monto_usd, monto_bs, tasa_registro)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          nominaId,
          inc.tipoIncidenciaId,
          inc.frecuencia,
          inc.fechaEfectiva,
          Number(inc.montoUsd) || 0,
          Number(inc.montoBs) || 0,
          Number(inc.tasaRegistro) || 0,
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ id: nominaId }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "Ya existe una Nómina con ese nombre"
        : "Error al crear la Nómina";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

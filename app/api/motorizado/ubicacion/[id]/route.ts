import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// Solo usuarios autenticados (web admin/delivery) pueden consultar la ubicación
export async function GET(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const result = await pool.query(
    `SELECT mu.motorizado_id, mu.lat, mu.lng, mu.updated_at,
            m.nombre, m.apellido
     FROM motorizado_ubicaciones mu
     JOIN motorizados m ON m.id = mu.motorizado_id
     WHERE mu.motorizado_id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ ubicacion: null });
  }

  const row = result.rows[0];
  return NextResponse.json({
    ubicacion: {
      motorizadoId: row.motorizado_id,
      lat: Number(row.lat),
      lng: Number(row.lng),
      updatedAt: row.updated_at,
      nombre: `${row.nombre}${row.apellido ? " " + row.apellido : ""}`,
    },
  });
}

// Endpoint para obtener ubicaciones de todos los motorizados activos
export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT mu.motorizado_id, mu.lat, mu.lng, mu.updated_at,
            m.nombre, m.apellido
     FROM motorizado_ubicaciones mu
     JOIN motorizados m ON m.id = mu.motorizado_id
     WHERE mu.updated_at > now() - interval '5 minutes'`
  );

  const ubicaciones = result.rows.map((row) => ({
    motorizadoId: row.motorizado_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    updatedAt: row.updated_at,
    nombre: `${row.nombre}${row.apellido ? " " + row.apellido : ""}`,
  }));

  return NextResponse.json({ ubicaciones });
}

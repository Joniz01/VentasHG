import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const incluirInactivos = request.nextUrl.searchParams.get("all") === "1";

  try {
    const result = await pool.query(
      incluirInactivos
        ? `SELECT id, nombre, activo FROM tipos_gasto ORDER BY nombre ASC`
        : `SELECT id, nombre, activo FROM tipos_gasto WHERE activo = TRUE ORDER BY nombre ASC`
    );
    return NextResponse.json(
      result.rows.map((r) => ({ id: r.id, nombre: r.nombre, activo: r.activo }))
    );
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as { nombre?: string };
  const nombre = body.nombre?.trim();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tipos_gasto (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET activo = TRUE
       RETURNING id, nombre, activo`,
      [nombre]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Error al crear el tipo de gasto" }, { status: 400 });
  }
}

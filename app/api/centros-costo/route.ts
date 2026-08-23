import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

function mapCentro(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion ?? null,
    activo: r.activo,
    createdAt: r.created_at,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const soloActivos = searchParams.get("activos") !== "false";
    const where = soloActivos ? "WHERE activo = TRUE" : "";
    const result = await pool.query(
      `SELECT * FROM centros_costo ${where} ORDER BY nombre ASC`
    );
    return NextResponse.json(result.rows.map(mapCentro));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  try {
    const result = await pool.query(
      `INSERT INTO centros_costo (nombre, descripcion, activo) VALUES ($1,$2,$3) RETURNING *`,
      [nombre, body.descripcion?.trim() || null, body.activo ?? true]
    );
    return NextResponse.json(mapCentro(result.rows[0]), { status: 201 });
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("duplicate")
      ? "Ya existe un centro de costo con ese nombre"
      : "Error al crear el centro de costo";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const soloActivos = searchParams.get("activos") !== "false";

  try {
    const result = await pool.query(
      `SELECT id, nombre, descripcion, activo, created_at
       FROM cargos
       ${soloActivos ? "WHERE activo = TRUE" : ""}
       ORDER BY nombre ASC`
    );
    return NextResponse.json(result.rows);
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
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  try {
    const result = await pool.query(
      `INSERT INTO cargos (nombre, descripcion) VALUES ($1, $2) RETURNING id`,
      [nombre, body.descripcion?.trim() || null]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("cargos_nombre_uq")) {
      return NextResponse.json({ error: "Ya existe un cargo con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al crear el cargo" }, { status: 400 });
  }
}

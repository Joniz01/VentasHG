import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  try {
    const result = await pool.query(
      `SELECT id, nombre, rif_ci, direccion, telefono
       FROM proveedores
       WHERE activo = TRUE ${q ? "AND lower(nombre) LIKE lower($1)" : ""}
       ORDER BY nombre ASC LIMIT 50`,
      q ? [`%${q}%`] : []
    );
    return NextResponse.json(result.rows.map((r) => ({
      id: r.id, nombre: r.nombre, rifCi: r.rif_ci,
      direccion: r.direccion, telefono: r.telefono,
    })));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { nombre, rifCi, direccion, telefono } = body;
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  try {
    const r = await pool.query(
      `INSERT INTO proveedores (nombre, rif_ci, direccion, telefono)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [nombre.trim(), rifCi?.trim() || null, direccion?.trim() || null, telefono?.trim() || null]
    );
    return NextResponse.json({ id: r.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

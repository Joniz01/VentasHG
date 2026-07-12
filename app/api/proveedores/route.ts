import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  try {
    const rif = searchParams.get("rif");
    let queryText: string;
    let queryParams: string[];
    if (rif) {
      queryText = `SELECT id, nombre, rif_ci, direccion, telefono, dias_credito FROM proveedores WHERE activo = TRUE AND lower(rif_ci) = lower($1) LIMIT 1`;
      queryParams = [rif.trim()];
    } else {
      queryText = `SELECT id, nombre, rif_ci, direccion, telefono, dias_credito FROM proveedores WHERE activo = TRUE ${q ? "AND lower(nombre) LIKE lower($1)" : ""} ORDER BY nombre ASC LIMIT 50`;
      queryParams = q ? [`%${q}%`] : [];
    }
    const result = await pool.query(queryText, queryParams);
    const items = result.rows.map((r) => ({
      id: r.id, nombre: r.nombre, rifCi: r.rif_ci,
      direccion: r.direccion, telefono: r.telefono,
      diasCredito: Number(r.dias_credito ?? 0),
    }));
    return NextResponse.json({ items });
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

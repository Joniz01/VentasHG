import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    const r = await pool.query(
      `SELECT id, nombre, rif_ci, direccion, telefono, dias_credito, activo FROM proveedores WHERE id = $1`,
      [id]
    );
    if (!r.rowCount) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const p = r.rows[0];
    return NextResponse.json({ id: p.id, nombre: p.nombre, rifCi: p.rif_ci, direccion: p.direccion, telefono: p.telefono, diasCredito: Number(p.dias_credito), activo: p.activo });
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { nombre, rifCi, direccion, telefono, diasCredito, activo } = body;
  try {
    const r = await pool.query(
      `UPDATE proveedores SET
        nombre = COALESCE($1, nombre),
        rif_ci = COALESCE($2, rif_ci),
        direccion = COALESCE($3, direccion),
        telefono = COALESCE($4, telefono),
        dias_credito = COALESCE($5, dias_credito),
        activo = COALESCE($6, activo)
       WHERE id = $7 RETURNING id`,
      [nombre ?? null, rifCi ?? null, direccion ?? null, telefono ?? null,
       diasCredito != null ? Number(diasCredito) : null,
       activo != null ? activo : null, id]
    );
    if (!r.rowCount) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) { return NextResponse.json({ error: String(err) }, { status: 500 }); }
}

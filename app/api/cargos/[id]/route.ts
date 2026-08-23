import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  try {
    const result = await pool.query(
      `UPDATE cargos SET nombre = $1, descripcion = $2, activo = $3 WHERE id = $4 RETURNING id`,
      [nombre, body.descripcion?.trim() || null, body.activo ?? true, id]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("cargos_nombre_uq")) {
      return NextResponse.json({ error: "Ya existe un cargo con ese nombre" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al actualizar el cargo" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Soft-delete si hay empleados con este cargo
    const enUso = await pool.query(
      `SELECT 1 FROM empleados WHERE cargo_id = $1 AND activo = TRUE LIMIT 1`,
      [id]
    );
    if ((enUso.rowCount ?? 0) > 0) {
      await pool.query(`UPDATE cargos SET activo = FALSE WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true, desactivado: true });
    }
    const result = await pool.query(`DELETE FROM cargos WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return NextResponse.json({ error: "Cargo no encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar el cargo" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  try {
    const result = await pool.query(
      `UPDATE centros_costo SET nombre=$1, descripcion=$2, activo=$3 WHERE id=$4 RETURNING *`,
      [nombre, body.descripcion?.trim() || null, body.activo ?? true, Number(id)]
    );
    if (!result.rows.length) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({
      id: result.rows[0].id,
      nombre: result.rows[0].nombre,
      descripcion: result.rows[0].descripcion,
      activo: result.rows[0].activo,
    });
  } catch (err) {
    const msg = err instanceof Error && err.message.includes("duplicate")
      ? "Ya existe un centro de costo con ese nombre"
      : "Error al actualizar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  try {
    // Soft delete: desactivar si está en uso, eliminar si no
    const uso = await pool.query(
      `SELECT (SELECT COUNT(*) FROM nominas WHERE centro_costo_id=$1) + (SELECT COUNT(*) FROM gastos WHERE centro_costo_id=$1) AS total`,
      [Number(id)]
    );
    if (Number(uso.rows[0]?.total) > 0) {
      await pool.query(`UPDATE centros_costo SET activo=FALSE WHERE id=$1`, [Number(id)]);
      return NextResponse.json({ desactivado: true });
    }
    await pool.query(`DELETE FROM centros_costo WHERE id=$1`, [Number(id)]);
    return NextResponse.json({ eliminado: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

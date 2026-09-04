import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { activo?: boolean; nombre?: string };

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (typeof body.activo === "boolean") {
    sets.push(`activo = $${i++}`);
    values.push(body.activo);
  }
  if (typeof body.nombre === "string" && body.nombre.trim()) {
    sets.push(`nombre = $${i++}`);
    values.push(body.nombre.trim());
  }

  if (!sets.length) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE tipos_gasto SET ${sets.join(", ")} WHERE id = $${i} RETURNING id, nombre, activo`,
      values
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: "Tipo de gasto no encontrado" }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch {
    return NextResponse.json({ error: "Error al actualizar el tipo de gasto" }, { status: 400 });
  }
}

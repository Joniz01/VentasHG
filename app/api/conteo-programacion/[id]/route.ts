import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.programarConteo)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json() as {
    accion?: "toggle";
    nombre?: string;
    alcance?: string;
    categoriaId?: number | null;
    productoId?: number | null;
    uso?: string | null;
    recurrencia?: string;
    diasSemana?: string[];
    diaNumero?: number | null;
    fechaEspecifica?: string | null;
    usuariosAlerta?: number[];
    activo?: boolean;
  };

  if (body.accion === "toggle") {
    await pool.query(`UPDATE conteo_programacion SET activo = NOT activo WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  }

  const sets: string[] = [];
  const vals: unknown[] = [id];
  const add = (col: string, val: unknown) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

  if (body.nombre !== undefined) add("nombre", body.nombre.trim());
  if (body.alcance !== undefined) add("alcance", body.alcance);
  if (body.categoriaId !== undefined) add("categoria_id", body.categoriaId);
  if (body.productoId !== undefined) add("producto_id", body.productoId);
  if (body.uso !== undefined) add("uso", body.uso);
  if (body.recurrencia !== undefined) add("recurrencia", body.recurrencia);
  if (body.diasSemana !== undefined) add("dias_semana", body.diasSemana?.length ? body.diasSemana : null);
  if (body.diaNumero !== undefined) add("dia_numero", body.diaNumero);
  if (body.fechaEspecifica !== undefined) add("fecha_especifica", body.fechaEspecifica);
  if (body.usuariosAlerta !== undefined) add("usuarios_alerta", body.usuariosAlerta?.length ? body.usuariosAlerta : null);
  if (body.activo !== undefined) add("activo", body.activo);

  if (!sets.length) return NextResponse.json({ ok: true });

  await pool.query(`UPDATE conteo_programacion SET ${sets.join(", ")} WHERE id = $1`, vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.programarConteo)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  await pool.query(`DELETE FROM conteo_programacion WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

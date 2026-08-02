import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.nombre === "string" && body.nombre.trim()) {
    fields.push(`nombre = $${fields.length + 1}`);
    values.push(body.nombre.trim());
  }
  if (typeof body.usuario === "string" && body.usuario.trim()) {
    fields.push(`usuario = $${fields.length + 1}`);
    values.push(body.usuario.trim());
  }
  if (typeof body.clave === "string" && body.clave.trim()) {
    fields.push(`clave_hash = $${fields.length + 1}`);
    values.push(hashPassword(body.clave.trim()));
  }
  if (typeof body.activo === "boolean") {
    fields.push(`activo = $${fields.length + 1}`);
    values.push(body.activo);
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  values.push(id);
  try {
    await pool.query(
      `UPDATE conteo_usuarios SET ${fields.join(", ")} WHERE id = $${values.length}`,
      values
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "El usuario ya existe" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await pool.query(`DELETE FROM conteo_usuarios WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}

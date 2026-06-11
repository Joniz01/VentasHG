import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { MotorizadoInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as Partial<MotorizadoInput> & { activo?: boolean };

  if (!body.nombre?.trim() || !body.usuario?.trim()) {
    return NextResponse.json({ error: "Nombre y usuario son obligatorios" }, { status: 400 });
  }

  try {
    const result = body.clave?.trim()
      ? await pool.query(
          `UPDATE motorizados
           SET nombre = $1, apellido = $2, telefono = $3, usuario = $4, clave_hash = $5, activo = $6
           WHERE id = $7
           RETURNING id`,
          [
            body.nombre.trim(),
            body.apellido?.trim() || null,
            body.telefono?.trim() || null,
            body.usuario.trim(),
            hashPassword(body.clave),
            body.activo ?? true,
            id,
          ]
        )
      : await pool.query(
          `UPDATE motorizados
           SET nombre = $1, apellido = $2, telefono = $3, usuario = $4, activo = $5
           WHERE id = $6
           RETURNING id`,
          [
            body.nombre.trim(),
            body.apellido?.trim() || null,
            body.telefono?.trim() || null,
            body.usuario.trim(),
            body.activo ?? true,
            id,
          ]
        );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Motorizado no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "El usuario ya existe"
        : "Error al actualizar el motorizado";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await pool.query(`DELETE FROM motorizados WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Motorizado no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { validarCedulaRif, validarTelefono } from "@/lib/validacion";
import type { ClienteInput } from "@/lib/types";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Partial<ClienteInput>;

  const nombre = body.nombre?.trim() ?? "";
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const cedula = body.cedula?.trim() ?? "";
  const errorCedula = validarCedulaRif(cedula);
  if (errorCedula) {
    return NextResponse.json({ error: errorCedula }, { status: 400 });
  }

  const telefono = body.telefono?.trim() ?? "";
  const errorTelefono = validarTelefono(telefono);
  if (errorTelefono) {
    return NextResponse.json({ error: errorTelefono }, { status: 400 });
  }

  const apellido = body.apellido?.trim() ?? "";
  const direccion = body.direccion?.trim() ?? "";

  try {
    const result = await pool.query(
      `UPDATE clientes
       SET nombre = $1, apellido = $2, cedula = $3, direccion = $4, telefono = $5
       WHERE id = $6
       RETURNING id, nombre, apellido, cedula, direccion, telefono`,
      [nombre, apellido || null, cedula || null, direccion || null, telefono || null, id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Ya existe un cliente con esa C.I/Rif" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const result = await pool.query(`DELETE FROM clientes WHERE id = $1 RETURNING id`, [id]);

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

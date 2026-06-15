import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { validarCedulaRif } from "@/lib/validacion";
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

  const direccion = body.direccion?.trim() ?? "";
  const telefono = body.telefono?.trim() ?? "";

  try {
    const result = await pool.query(
      `UPDATE clientes
       SET nombre = $1, cedula = $2, direccion = $3, telefono = $4
       WHERE id = $5
       RETURNING id, nombre, cedula, direccion, telefono`,
      [nombre, cedula || null, direccion || null, telefono || null, id]
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

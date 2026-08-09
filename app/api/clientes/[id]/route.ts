import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { validarCedulaRif } from "@/lib/validacion";
import type { ClienteInput } from "@/lib/types";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Partial<ClienteInput & { esProveedor?: boolean }>;

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
  const esProveedor = body.esProveedor === true;

  try {
    const result = await pool.query(
      `UPDATE clientes
       SET nombre = $1, cedula = $2, direccion = $3, telefono = $4, es_proveedor = $5
       WHERE id = $6
       RETURNING id, nombre, cedula, direccion, telefono, es_proveedor`,
      [nombre, cedula || null, direccion || null, telefono || null, esProveedor, id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Ya existe un cliente con esa C.I/Rif" }, { status: 409 });
    }
    // columna es_proveedor pendiente de migración — guardar sin ella
    try {
      const result = await pool.query(
        `UPDATE clientes SET nombre = $1, cedula = $2, direccion = $3, telefono = $4 WHERE id = $5
         RETURNING id, nombre, cedula, direccion, telefono`,
        [nombre, cedula || null, direccion || null, telefono || null, id]
      );
      if (!result.rows[0]) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      return NextResponse.json(result.rows[0]);
    } catch (err2) {
      if (err2 instanceof Error && "code" in err2 && (err2 as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Ya existe un cliente con esa C.I/Rif" }, { status: 409 });
      }
      throw err2;
    }
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as { esProveedor?: boolean };

  try {
    const result = await pool.query(
      `UPDATE clientes SET es_proveedor = $1 WHERE id = $2 RETURNING id, es_proveedor`,
      [body.esProveedor === true, id]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ id: result.rows[0].id, esProveedor: result.rows[0].es_proveedor });
  } catch {
    // columna es_proveedor pendiente de migración — verificar que el cliente existe
    const check = await pool.query(`SELECT id FROM clientes WHERE id = $1`, [id]);
    if (!check.rows[0]) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json({ id: Number(id), esProveedor: body.esProveedor ?? false });
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

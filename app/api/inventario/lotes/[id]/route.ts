import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// PATCH — adjust quantity or close lot
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { cantidadActual, activo } = body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (cantidadActual !== undefined) {
    const n = Number(cantidadActual);
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    fields.push(`cantidad_actual = $${fields.length + 1}`);
    values.push(n);
  }

  if (activo !== undefined) {
    fields.push(`activo = $${fields.length + 1}`);
    values.push(Boolean(activo));
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE lotes_inventario SET ${fields.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

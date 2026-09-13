import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, abreviatura, tipo } = body;

  const TIPOS_VALIDOS = ["UNIDAD", "MASA", "VOLUMEN", "LONGITUD"];
  if (!nombre?.trim() || !abreviatura?.trim() || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE unidades_medida SET nombre = $1, abreviatura = $2, tipo = $3 WHERE id = $4
     RETURNING id, nombre, abreviatura, tipo`,
    [nombre.trim(), abreviatura.trim(), tipo, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const prodResult = await pool.query(
    `SELECT COUNT(*) AS total FROM productos WHERE unidad_medida_id = $1`,
    [id]
  );
  const total = Number(prodResult.rows[0]?.total ?? 0);
  if (total > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${total} producto(s) tienen esta unidad asignada. Reasígnalos primero.` },
      { status: 409 }
    );
  }

  const result = await pool.query(`DELETE FROM unidades_medida WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

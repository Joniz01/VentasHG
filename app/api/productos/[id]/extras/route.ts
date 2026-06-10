import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { extraId, precioAdicional } = body;

  const extraIdNum = Number(extraId);
  if (!extraIdNum) {
    return NextResponse.json({ error: "Debes seleccionar un extra" }, { status: 400 });
  }

  const precioNum = Number(precioAdicional);
  if (Number.isNaN(precioNum)) {
    return NextResponse.json({ error: "El monto adicional debe ser numérico" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO producto_extras (producto_id, extra_id, precio_adicional)
     VALUES ($1, $2, $3)
     ON CONFLICT (producto_id, extra_id) DO UPDATE SET precio_adicional = EXCLUDED.precio_adicional
     RETURNING id, producto_id, extra_id, precio_adicional`,
    [id, extraIdNum, precioNum]
  );

  const row = result.rows[0];

  const nombreResult = await pool.query(
    `SELECT nombre FROM extras_catalogo WHERE id = $1`,
    [row.extra_id]
  );

  return NextResponse.json(
    {
      id: row.id,
      productoId: row.producto_id,
      extraId: row.extra_id,
      nombre: nombreResult.rows[0]?.nombre ?? "",
      precioAdicional: Number(row.precio_adicional),
    },
    { status: 201 }
  );
}

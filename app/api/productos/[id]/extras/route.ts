import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, precioAdicional } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json({ error: "El nombre del extra es obligatorio" }, { status: 400 });
  }

  const precioNum = Number(precioAdicional);
  if (Number.isNaN(precioNum)) {
    return NextResponse.json({ error: "El monto adicional debe ser numérico" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO producto_extras (producto_id, nombre, precio_adicional)
     VALUES ($1, $2, $3)
     RETURNING id, producto_id, nombre, precio_adicional`,
    [id, nombre.trim(), precioNum]
  );

  const row = result.rows[0];

  return NextResponse.json(
    {
      id: row.id,
      productoId: row.producto_id,
      nombre: row.nombre,
      precioAdicional: Number(row.precio_adicional),
    },
    { status: 201 }
  );
}

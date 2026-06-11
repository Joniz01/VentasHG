import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { componenteId, cantidad } = body;

  const componenteIdNum = Number(componenteId);
  if (!componenteIdNum) {
    return NextResponse.json({ error: "Debes seleccionar una bandeja" }, { status: 400 });
  }

  if (componenteIdNum === Number(id)) {
    return NextResponse.json(
      { error: "Un producto no puede ser componente de sí mismo" },
      { status: 400 }
    );
  }

  const cantidadNum = Number(cantidad);
  if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
    return NextResponse.json({ error: "La cantidad debe ser numérica y mayor a 0" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO producto_componentes (producto_id, componente_id, cantidad)
     VALUES ($1, $2, $3)
     ON CONFLICT (producto_id, componente_id) DO UPDATE SET cantidad = EXCLUDED.cantidad
     RETURNING id, producto_id, componente_id, cantidad`,
    [id, componenteIdNum, cantidadNum]
  );

  const row = result.rows[0];

  const nombreResult = await pool.query(`SELECT nombre FROM productos WHERE id = $1`, [
    row.componente_id,
  ]);

  return NextResponse.json(
    {
      id: row.id,
      productoId: row.producto_id,
      componenteId: row.componente_id,
      componenteNombre: nombreResult.rows[0]?.nombre ?? "",
      cantidad: Number(row.cantidad),
    },
    { status: 201 }
  );
}

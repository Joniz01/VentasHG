import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, descripcion, costo, precioVenta, activo } = body;

  const costoNum = Number(costo);
  const precioNum = Number(precioVenta);

  if (!nombre || Number.isNaN(costoNum) || Number.isNaN(precioNum)) {
    return NextResponse.json(
      { error: "Datos inválidos" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `UPDATE productos
     SET nombre = $1, descripcion = $2, costo = $3, precio_venta = $4, activo = $5
     WHERE id = $6
     RETURNING id, nombre, descripcion, costo, precio_venta, activo, created_at`,
    [nombre, descripcion ?? null, costoNum, precioNum, activo ?? true, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const row = result.rows[0];

  const extrasResult = await pool.query(
    `SELECT id, producto_id, nombre, precio_adicional
     FROM producto_extras
     WHERE producto_id = $1
     ORDER BY nombre ASC`,
    [id]
  );

  return NextResponse.json({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    costo: Number(row.costo),
    precioVenta: Number(row.precio_venta),
    activo: row.activo,
    createdAt: row.created_at,
    extras: extrasResult.rows.map((extra) => ({
      id: extra.id,
      productoId: extra.producto_id,
      nombre: extra.nombre,
      precioAdicional: Number(extra.precio_adicional),
    })),
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const result = await pool.query(`DELETE FROM productos WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se puede eliminar: el producto tiene ventas registradas. Puedes desactivarlo en su lugar.",
      },
      { status: 409 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, descripcion, costo, precioVenta, activo, categoriaId } = body;

  const costoNum = Number(costo);
  const precioNum = Number(precioVenta);

  if (!nombre || Number.isNaN(costoNum) || Number.isNaN(precioNum)) {
    return NextResponse.json(
      { error: "Datos inválidos" },
      { status: 400 }
    );
  }

  const categoriaIdNum = categoriaId ? Number(categoriaId) : null;

  const result = await pool.query(
    `UPDATE productos
     SET nombre = $1, descripcion = $2, costo = $3, precio_venta = $4, activo = $5, categoria_id = $6
     WHERE id = $7
     RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, created_at`,
    [nombre, descripcion ?? null, costoNum, precioNum, activo ?? true, categoriaIdNum, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const row = result.rows[0];

  let categoriaNombre: string | null = null;
  if (row.categoria_id) {
    const categoriaResult = await pool.query(
      `SELECT nombre FROM categorias WHERE id = $1`,
      [row.categoria_id]
    );
    categoriaNombre = categoriaResult.rows[0]?.nombre ?? null;
  }

  const extrasResult = await pool.query(
    `SELECT pe.id, pe.producto_id, pe.extra_id, pe.precio_adicional, ec.nombre
     FROM producto_extras pe
     JOIN extras_catalogo ec ON ec.id = pe.extra_id
     WHERE pe.producto_id = $1
     ORDER BY ec.nombre ASC`,
    [id]
  );

  return NextResponse.json({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    costo: Number(row.costo),
    precioVenta: Number(row.precio_venta),
    activo: row.activo,
    categoriaId: row.categoria_id,
    categoriaNombre,
    createdAt: row.created_at,
    extras: extrasResult.rows.map((extra) => ({
      id: extra.id,
      productoId: extra.producto_id,
      extraId: extra.extra_id,
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

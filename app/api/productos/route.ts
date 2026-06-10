import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT p.id, p.nombre, p.descripcion, p.costo, p.precio_venta, p.activo, p.created_at,
            p.categoria_id, c.nombre AS categoria_nombre
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     ORDER BY p.nombre ASC`
  );

  const productoIds = result.rows.map((row) => row.id);

  const extrasResult = productoIds.length
    ? await pool.query(
        `SELECT pe.id, pe.producto_id, pe.extra_id, pe.precio_adicional, ec.nombre
         FROM producto_extras pe
         JOIN extras_catalogo ec ON ec.id = pe.extra_id
         WHERE pe.producto_id = ANY($1::int[])
         ORDER BY ec.nombre ASC`,
        [productoIds]
      )
    : { rows: [] };

  const productos = result.rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    costo: Number(row.costo),
    precioVenta: Number(row.precio_venta),
    activo: row.activo,
    categoriaId: row.categoria_id,
    categoriaNombre: row.categoria_nombre,
    createdAt: row.created_at,
    extras: extrasResult.rows
      .filter((extra) => extra.producto_id === row.id)
      .map((extra) => ({
        id: extra.id,
        productoId: extra.producto_id,
        extraId: extra.extra_id,
        nombre: extra.nombre,
        precioAdicional: Number(extra.precio_adicional),
      })),
  }));

  return NextResponse.json(productos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, descripcion, costo, precioVenta, categoriaId } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json(
      { error: "El nombre del producto es obligatorio" },
      { status: 400 }
    );
  }

  const costoNum = Number(costo);
  const precioNum = Number(precioVenta);

  if (Number.isNaN(costoNum) || Number.isNaN(precioNum)) {
    return NextResponse.json(
      { error: "Costo y precio de venta deben ser numéricos" },
      { status: 400 }
    );
  }

  const categoriaIdNum = categoriaId ? Number(categoriaId) : null;

  const result = await pool.query(
    `INSERT INTO productos (nombre, descripcion, costo, precio_venta, categoria_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, created_at`,
    [nombre, descripcion ?? null, costoNum, precioNum, categoriaIdNum]
  );

  const row = result.rows[0];

  let categoriaNombre: string | null = null;
  if (row.categoria_id) {
    const categoriaResult = await pool.query(
      `SELECT nombre FROM categorias WHERE id = $1`,
      [row.categoria_id]
    );
    categoriaNombre = categoriaResult.rows[0]?.nombre ?? null;
  }

  return NextResponse.json(
    {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      costo: Number(row.costo),
      precioVenta: Number(row.precio_venta),
      activo: row.activo,
      categoriaId: row.categoria_id,
      categoriaNombre,
      createdAt: row.created_at,
      extras: [],
    },
    { status: 201 }
  );
}

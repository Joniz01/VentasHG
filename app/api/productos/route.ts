import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre, descripcion, costo, precio_venta, activo, created_at
     FROM productos
     ORDER BY nombre ASC`
  );

  const productoIds = result.rows.map((row) => row.id);

  const extrasResult = productoIds.length
    ? await pool.query(
        `SELECT id, producto_id, nombre, precio_adicional
         FROM producto_extras
         WHERE producto_id = ANY($1::int[])
         ORDER BY nombre ASC`,
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
    createdAt: row.created_at,
    extras: extrasResult.rows
      .filter((extra) => extra.producto_id === row.id)
      .map((extra) => ({
        id: extra.id,
        productoId: extra.producto_id,
        nombre: extra.nombre,
        precioAdicional: Number(extra.precio_adicional),
      })),
  }));

  return NextResponse.json(productos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, descripcion, costo, precioVenta } = body;

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

  const result = await pool.query(
    `INSERT INTO productos (nombre, descripcion, costo, precio_venta)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, descripcion, costo, precio_venta, activo, created_at`,
    [nombre, descripcion ?? null, costoNum, precioNum]
  );

  const row = result.rows[0];

  return NextResponse.json(
    {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      costo: Number(row.costo),
      precioVenta: Number(row.precio_venta),
      activo: row.activo,
      createdAt: row.created_at,
      extras: [],
    },
    { status: 201 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { validarCedulaRif, validarTelefono } from "@/lib/validacion";
import type { ClienteInput } from "@/lib/types";

const MIN_CHARS = 4;

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (q === null) {
    const result = await pool.query(
      `SELECT id, nombre, apellido, cedula, direccion, telefono
       FROM clientes
       ORDER BY nombre`
    );

    return NextResponse.json(
      result.rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        apellido: row.apellido,
        cedula: row.cedula,
        direccion: row.direccion,
        telefono: row.telefono,
      }))
    );
  }

  const query = q.trim();
  if (query.length < MIN_CHARS) {
    return NextResponse.json([]);
  }

  // Búsqueda por prefijo (case-insensitive) sobre nombre o cédula, usando
  // los índices lower(...) text_pattern_ops para que sea eficiente.
  const result = await pool.query(
    `SELECT id, nombre, apellido, cedula, direccion, telefono
     FROM clientes
     WHERE lower(nombre) LIKE lower($1) || '%'
        OR lower(cedula) LIKE lower($1) || '%'
     ORDER BY nombre
     LIMIT 10`,
    [query]
  );

  return NextResponse.json(
    result.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      apellido: row.apellido,
      cedula: row.cedula,
      direccion: row.direccion,
      telefono: row.telefono,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<ClienteInput>;

  const nombre = body.nombre?.trim() ?? "";
  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const cedula = body.cedula?.trim() ?? "";
  const errorCedula = validarCedulaRif(cedula);
  if (errorCedula) {
    return NextResponse.json({ error: errorCedula }, { status: 400 });
  }

  const telefono = body.telefono?.trim() ?? "";
  const errorTelefono = validarTelefono(telefono);
  if (errorTelefono) {
    return NextResponse.json({ error: errorTelefono }, { status: 400 });
  }

  const apellido = body.apellido?.trim() ?? "";
  const direccion = body.direccion?.trim() ?? "";

  try {
    const result = await pool.query(
      `INSERT INTO clientes (nombre, apellido, cedula, direccion, telefono)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, apellido, cedula, direccion, telefono`,
      [nombre, apellido || null, cedula || null, direccion || null, telefono || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Ya existe un cliente con esa C.I/Rif" }, { status: 409 });
    }
    throw err;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { ConteoUsuarioInput } from "@/lib/types";

export async function GET() {
  const result = await pool.query(
    `SELECT id, nombre, usuario, activo FROM conteo_usuarios ORDER BY nombre ASC`
  );
  return NextResponse.json(
    result.rows.map((r) => ({ id: r.id, nombre: r.nombre, usuario: r.usuario, activo: r.activo }))
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ConteoUsuarioInput;

  if (!body.nombre?.trim() || !body.usuario?.trim() || !body.clave?.trim()) {
    return NextResponse.json({ error: "Nombre, usuario y clave son obligatorios" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO conteo_usuarios (nombre, usuario, clave_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [body.nombre.trim(), body.usuario.trim(), hashPassword(body.clave)]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "El usuario ya existe" }, { status: 400 });
  }
}

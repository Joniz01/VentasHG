import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { imagenUrl } = body; // data URI string or null to clear

  if (imagenUrl !== null && typeof imagenUrl !== "string") {
    return NextResponse.json({ error: "imagenUrl debe ser string o null" }, { status: 400 });
  }

  // Validate it's a data URI if provided
  if (imagenUrl && !imagenUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Formato de imagen inválido" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `UPDATE productos SET imagen_url = $1 WHERE id = $2 RETURNING id`,
      [imagenUrl ?? null, id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al guardar imagen" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await pool.query(
    `SELECT imagen_url FROM productos WHERE id = $1`,
    [id]
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ imagenUrl: result.rows[0].imagen_url ?? null });
}

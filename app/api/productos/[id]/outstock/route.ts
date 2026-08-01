import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { desactivada, motivo } = await request.json();

  if (typeof desactivada !== "boolean") {
    return NextResponse.json({ error: "Campo 'desactivada' requerido (boolean)" }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE productos
       SET alerta_outstock_desactivada = $1,
           alerta_outstock_motivo      = $2
       WHERE id = $3`,
      [desactivada, desactivada ? (motivo ?? null) : null, id]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar (¿migración 046 aplicada?)" }, { status: 500 });
  }
}

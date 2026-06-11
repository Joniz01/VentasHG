import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await pool.query(
    `UPDATE ventas SET pedido_entregado = TRUE WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

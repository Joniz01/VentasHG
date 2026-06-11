import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let entregado = true;
  try {
    const body = (await request.json()) as { entregado?: boolean };
    if (typeof body.entregado === "boolean") entregado = body.entregado;
  } catch {
    // sin body: marcar como entregado
  }

  const result = await pool.query(
    `UPDATE ventas SET pedido_entregado = $2 WHERE id = $1 RETURNING id`,
    [id, entregado]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MOTORIZADO_SESSION_COOKIE, getMotorizadoIdFromSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const token = request.cookies.get(MOTORIZADO_SESSION_COOKIE)?.value;
  const motorizadoId = token ? await getMotorizadoIdFromSession(token) : null;

  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let entregado = true;
  try {
    const body = (await request.json()) as { entregado?: boolean };
    if (typeof body.entregado === "boolean") entregado = body.entregado;
  } catch {
    // sin body: marcar como entregado
  }

  const result = await pool.query(
    `UPDATE ventas SET pedido_entregado = $3 WHERE id = $1 AND motorizado_id = $2 RETURNING id`,
    [id, motorizadoId, entregado]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

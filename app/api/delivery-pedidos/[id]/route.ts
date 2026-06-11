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

  let entregado: boolean | undefined;
  let aceptado: boolean | undefined;
  try {
    const body = (await request.json()) as { entregado?: boolean; aceptado?: boolean };
    if (typeof body.entregado === "boolean") entregado = body.entregado;
    if (typeof body.aceptado === "boolean") aceptado = body.aceptado;
  } catch {
    // sin body: marcar como entregado
  }

  if (entregado === undefined && aceptado === undefined) entregado = true;

  const result =
    aceptado !== undefined
      ? await pool.query(
          `UPDATE ventas SET pedido_aceptado = $3 WHERE id = $1 AND motorizado_id = $2 RETURNING id`,
          [id, motorizadoId, aceptado]
        )
      : await pool.query(
          `UPDATE ventas SET pedido_entregado = $3 WHERE id = $1 AND motorizado_id = $2 RETURNING id`,
          [id, motorizadoId, entregado]
        );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getMotorizadoIdFromRequest } from "@/lib/motorizado-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const motorizadoId = await getMotorizadoIdFromRequest(request);
  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as {
    pedidoAceptado?: boolean;
    pedidoEnviado?: boolean;
    pedidoEntregado?: boolean;
  };

  // Validar que el pedido pertenece a este motorizado
  const check = await pool.query(
    `SELECT id FROM ventas WHERE id = $1 AND motorizado_id = $2`,
    [id, motorizadoId]
  );
  if (check.rowCount === 0) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.pedidoAceptado !== undefined) {
    setClauses.push(`pedido_aceptado = $${idx++}`);
    values.push(body.pedidoAceptado);
  }
  if (body.pedidoEnviado !== undefined) {
    setClauses.push(`pedido_enviado = $${idx++}`);
    values.push(body.pedidoEnviado);
  }
  if (body.pedidoEntregado !== undefined) {
    setClauses.push(`pedido_entregado = $${idx++}`);
    values.push(body.pedidoEntregado);
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  values.push(id);
  await pool.query(
    `UPDATE ventas SET ${setClauses.join(", ")} WHERE id = $${idx}`,
    values
  );

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { METODOS_PAGO } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let entregado: boolean | undefined;
  let enviado: boolean | undefined;
  let pagos: { metodo: string; monto: number }[] | undefined;
  try {
    const body = (await request.json()) as { entregado?: boolean; enviado?: boolean; pagos?: { metodo: string; monto: number }[] };
    if (typeof body.entregado === "boolean") entregado = body.entregado;
    if (typeof body.enviado === "boolean") enviado = body.enviado;
    if (Array.isArray(body.pagos)) pagos = body.pagos;
  } catch {
    // sin body: marcar como entregado
  }

  // Registrar pagos y limpiar cuenta_por_cobrar
  if (pagos !== undefined) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const pago of pagos) {
        if (!METODOS_PAGO.includes(pago.metodo as (typeof METODOS_PAGO)[number])) continue;
        const monto = Number(pago.monto);
        if (Number.isNaN(monto) || monto <= 0) continue;
        await client.query(
          `INSERT INTO pagos_venta (venta_id, metodo, monto) VALUES ($1, $2, $3)`,
          [id, pago.metodo, monto]
        );
      }
      const result = await client.query(
        `UPDATE ventas SET cuenta_por_cobrar = FALSE WHERE id = $1 RETURNING id`,
        [id]
      );
      await client.query("COMMIT");
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      const message = err instanceof Error ? err.message : "Error al registrar pago";
      return NextResponse.json({ error: message }, { status: 400 });
    } finally {
      client.release();
    }
  }

  if (entregado === undefined && enviado === undefined) entregado = true;

  const result =
    enviado !== undefined
      ? await pool.query(
          `UPDATE ventas SET pedido_enviado = $2 WHERE id = $1 RETURNING id`,
          [id, enviado]
        )
      : await pool.query(
          `UPDATE ventas SET pedido_entregado = $2 WHERE id = $1 RETURNING id`,
          [id, entregado]
        );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

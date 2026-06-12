import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { cuentaCobrada } = body;

  if (typeof cuentaCobrada !== "boolean") {
    return NextResponse.json({ error: "cuentaCobrada debe ser booleano" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE ventas
     SET cuenta_cobrada = $1,
         cuenta_cobrada_at = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $2 AND cuenta_por_cobrar = TRUE
     RETURNING id, cuenta_cobrada, cuenta_cobrada_at`,
    [cuentaCobrada, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Cuenta por cobrar no encontrada" }, { status: 404 });
  }

  const row = result.rows[0];
  return NextResponse.json({
    ventaId: row.id,
    cuentaCobrada: row.cuenta_cobrada,
    cuentaCobradaAt: row.cuenta_cobrada_at,
  });
}

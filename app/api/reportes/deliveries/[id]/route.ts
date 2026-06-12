import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { deliveryPagado } = body;

  if (typeof deliveryPagado !== "boolean") {
    return NextResponse.json({ error: "deliveryPagado debe ser booleano" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE ventas
     SET delivery_pagado = $1,
         delivery_pagado_at = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $2 AND despacho_pendiente = TRUE
     RETURNING id, delivery_pagado, delivery_pagado_at`,
    [deliveryPagado, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Pedido de delivery no encontrado" }, { status: 404 });
  }

  const row = result.rows[0];
  return NextResponse.json({
    ventaId: row.id,
    deliveryPagado: row.delivery_pagado,
    deliveryPagadoAt: row.delivery_pagado_at,
  });
}

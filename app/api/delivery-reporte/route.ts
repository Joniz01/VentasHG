import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MOTORIZADO_SESSION_COOKIE, getMotorizadoIdFromSession } from "@/lib/auth";

const MAX_DIAS_ATRAS = 21;

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MOTORIZADO_SESSION_COOKIE)?.value;
  const motorizadoId = token ? await getMotorizadoIdFromSession(token) : null;

  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  if (!desde || !hasta) {
    return NextResponse.json(
      { error: "Debes indicar el rango de fechas (desde y hasta)" },
      { status: 400 }
    );
  }

  const limiteDesde = new Date();
  limiteDesde.setDate(limiteDesde.getDate() - MAX_DIAS_ATRAS);
  const limiteDesdeStr = limiteDesde.toISOString().slice(0, 10);

  if (desde < limiteDesdeStr) {
    return NextResponse.json(
      { error: `El rango no puede ser mayor a ${MAX_DIAS_ATRAS} días atrás` },
      { status: 400 }
    );
  }

  const result = await pool.query(
    `SELECT id, cliente, fecha, costo_delivery, tasa_dia
     FROM ventas
     WHERE motorizado_id = $1
       AND fecha BETWEEN $2 AND $3
       AND despacho_pendiente = TRUE
     ORDER BY fecha ASC, id ASC`,
    [motorizadoId, desde, hasta]
  );

  const items = result.rows.map((row) => {
    const costoDeliveryUsd = Number(row.costo_delivery);
    const tasa = Number(row.tasa_dia);
    return {
      ventaId: row.id,
      cliente: row.cliente,
      fecha: row.fecha,
      costoDeliveryUsd,
      costoDeliveryBs: costoDeliveryUsd * tasa,
    };
  });

  const totalUsd = items.reduce((acc, item) => acc + item.costoDeliveryUsd, 0);
  const totalBs = items.reduce((acc, item) => acc + item.costoDeliveryBs, 0);

  return NextResponse.json({ desde, hasta, items, totalUsd, totalBs });
}

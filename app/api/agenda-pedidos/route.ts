import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const alertas = searchParams.get("alertas") === "true";
  const estado = searchParams.get("estado");

  try {
    let query: string;
    let params: unknown[];

    if (alertas) {
      query = `
        SELECT id, cliente, cliente_telefono, items, total_usd,
               recordatorio_at, entrega_at, mins_preparacion, mins_retiro,
               estado, alerta_cobro_disparada, alerta_preparacion_disparada, alerta_retiro_disparada
        FROM agenda_pedidos
        WHERE estado = 'pendiente'
          AND (
            (alerta_cobro_disparada = FALSE AND recordatorio_at <= NOW())
            OR (alerta_preparacion_disparada = FALSE AND entrega_at IS NOT NULL
                AND entrega_at - (mins_preparacion * INTERVAL '1 minute') <= NOW())
            OR (alerta_retiro_disparada = FALSE AND entrega_at IS NOT NULL
                AND entrega_at - (mins_retiro * INTERVAL '1 minute') <= NOW())
          )
        ORDER BY recordatorio_at ASC`;
      params = [];
    } else {
      const conditions = ["estado != 'cancelada'"];
      if (estado) conditions.push(`estado = '${estado}'`);
      query = `
        SELECT id, cliente, cliente_telefono, items, total_usd,
               recordatorio_at, entrega_at, mins_preparacion, mins_retiro,
               estado, alerta_cobro_disparada, alerta_preparacion_disparada, alerta_retiro_disparada,
               venta_id, created_at
        FROM agenda_pedidos
        WHERE ${conditions.join(" AND ")}
        ORDER BY recordatorio_at ASC
        LIMIT 200`;
      params = [];
    }

    const result = await pool.query(query, params);
    const items = result.rows.map((r) => ({
      id: r.id,
      cliente: r.cliente,
      clienteTelefono: r.cliente_telefono,
      items: r.items,
      totalUsd: Number(r.total_usd),
      recordatorioAt: r.recordatorio_at,
      entregaAt: r.entrega_at,
      minsPreparacion: r.mins_preparacion,
      minsRetiro: r.mins_retiro,
      estado: r.estado,
      alertaCobroDisparada: r.alerta_cobro_disparada,
      alertaPreparacionDisparada: r.alerta_preparacion_disparada,
      alertaRetiroDisparada: r.alerta_retiro_disparada,
      ventaId: r.venta_id ?? null,
      createdAt: r.created_at,
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      cliente?: string | null;
      clienteTelefono?: string | null;
      items: { productoId: number; cantidad: number; extraId?: number | null; nombre: string; precio: number }[];
      totalUsd: number;
      recordatorioAt: string;
      entregaAt?: string | null;
      minsPreparacion?: number;
      minsRetiro?: number;
    };

    if (!body.recordatorioAt) return NextResponse.json({ error: "Fecha de recordatorio requerida" }, { status: 400 });
    if (!body.items?.length) return NextResponse.json({ error: "El pedido debe tener al menos un producto" }, { status: 400 });

    const result = await pool.query(
      `INSERT INTO agenda_pedidos
         (cliente, cliente_telefono, items, total_usd, recordatorio_at, entrega_at, mins_preparacion, mins_retiro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        body.cliente ?? null,
        body.clienteTelefono ?? null,
        JSON.stringify(body.items),
        body.totalUsd,
        body.recordatorioAt,
        body.entregaAt ?? null,
        body.minsPreparacion ?? 45,
        body.minsRetiro ?? 15,
      ]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

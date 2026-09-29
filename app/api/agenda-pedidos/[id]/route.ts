import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await request.json() as {
      estado?: string;
      alertaCobroDisparada?: boolean;
      alertaPreparacionDisparada?: boolean;
      alertaRetiroDisparada?: boolean;
      ventaId?: number;
      // edición completa
      cliente?: string | null;
      clienteTelefono?: string | null;
      items?: unknown[];
      totalUsd?: number;
      recordatorioAt?: string;
      entregaAt?: string | null;
      minsPreparacion?: number;
      minsRetiro?: number;
    };

    const sets: string[] = [];
    const vals: unknown[] = [id];

    if (body.estado !== undefined) { sets.push(`estado = $${vals.length + 1}`); vals.push(body.estado); }
    if (body.alertaCobroDisparada !== undefined) { sets.push(`alerta_cobro_disparada = $${vals.length + 1}`); vals.push(body.alertaCobroDisparada); }
    if (body.alertaPreparacionDisparada !== undefined) { sets.push(`alerta_preparacion_disparada = $${vals.length + 1}`); vals.push(body.alertaPreparacionDisparada); }
    if (body.alertaRetiroDisparada !== undefined) { sets.push(`alerta_retiro_disparada = $${vals.length + 1}`); vals.push(body.alertaRetiroDisparada); }
    if (body.ventaId !== undefined) { sets.push(`venta_id = $${vals.length + 1}`); vals.push(body.ventaId); }
    if (body.cliente !== undefined) { sets.push(`cliente = $${vals.length + 1}`); vals.push(body.cliente); }
    if (body.clienteTelefono !== undefined) { sets.push(`cliente_telefono = $${vals.length + 1}`); vals.push(body.clienteTelefono); }
    if (body.items !== undefined) { sets.push(`items = $${vals.length + 1}`); vals.push(JSON.stringify(body.items)); }
    if (body.totalUsd !== undefined) { sets.push(`total_usd = $${vals.length + 1}`); vals.push(body.totalUsd); }
    if (body.recordatorioAt !== undefined) { sets.push(`recordatorio_at = $${vals.length + 1}`); vals.push(body.recordatorioAt); }
    if ("entregaAt" in body) { sets.push(`entrega_at = $${vals.length + 1}`); vals.push(body.entregaAt ?? null); }
    if (body.minsPreparacion !== undefined) { sets.push(`mins_preparacion = $${vals.length + 1}`); vals.push(body.minsPreparacion); }
    if (body.minsRetiro !== undefined) { sets.push(`mins_retiro = $${vals.length + 1}`); vals.push(body.minsRetiro); }

    if (sets.length === 0) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

    const result = await pool.query(
      `UPDATE agenda_pedidos SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
      vals
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const result = await pool.query(
      `UPDATE agenda_pedidos SET estado = 'cancelada' WHERE id = $1 AND estado = 'pendiente' RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) return NextResponse.json({ error: "No encontrado o ya procesado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

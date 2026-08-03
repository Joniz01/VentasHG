import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string; empaqueId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { empaqueId } = await params;
  await pool.query(`DELETE FROM producto_empaques WHERE id = $1`, [empaqueId]);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(
    `UPDATE llm_api_keys
     SET quota_used = 0, quota_reset_at = NOW() + INTERVAL '1 day', updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getMotorizadoIdFromRequest } from "@/lib/motorizado-auth";

export async function POST(request: NextRequest) {
  const motorizadoId = await getMotorizadoIdFromRequest(request);
  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { token } = await request.json() as { token: string };

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token FCM requerido" }, { status: 400 });
  }

  await pool.query(
    `UPDATE motorizados SET fcm_token = $1 WHERE id = $2`,
    [token, motorizadoId]
  );

  return NextResponse.json({ ok: true });
}

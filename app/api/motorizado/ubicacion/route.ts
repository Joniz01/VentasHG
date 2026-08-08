import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getMotorizadoIdFromRequest } from "@/lib/motorizado-auth";

export async function POST(request: NextRequest) {
  const motorizadoId = await getMotorizadoIdFromRequest(request);
  if (!motorizadoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { lat, lng } = await request.json() as { lat: number; lng: number };

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat y lng requeridos" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO motorizado_ubicaciones (motorizado_id, lat, lng, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (motorizado_id) DO UPDATE
       SET lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           updated_at = now()`,
    [motorizadoId, lat, lng]
  );

  return NextResponse.json({ ok: true });
}

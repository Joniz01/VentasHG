import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS count FROM conteo_inventario WHERE estado = 'ENVIADO'`
    );
    return NextResponse.json({ count: Number(result.rows[0].count) });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

// Endpoint temporal de diagnóstico para inspeccionar el constraint
// gastos_categoria_check que está bloqueando el registro de gastos.
export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const constraints = await pool.query(
      `SELECT conname, pg_get_constraintdef(oid) AS definicion
       FROM pg_constraint
       WHERE conrelid = 'gastos'::regclass AND contype = 'c'`
    );
    return NextResponse.json({ constraints: constraints.rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

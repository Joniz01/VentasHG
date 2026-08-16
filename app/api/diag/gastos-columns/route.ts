import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

// Endpoint temporal de diagnóstico: lista las columnas reales de la tabla
// "gastos" en la base de datos conectada, para depurar un error de columna
// faltante que no cuadraba con las migraciones aplicadas. Solo ADMIN.
export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'gastos' ORDER BY ordinal_position`
    );
    const dbInfo = await pool.query(`SELECT current_database() AS db, current_schema() AS schema`);
    return NextResponse.json({
      database: dbInfo.rows[0]?.db,
      schema: dbInfo.rows[0]?.schema,
      columnas: cols.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

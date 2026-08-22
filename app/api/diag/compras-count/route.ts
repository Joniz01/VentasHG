import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Endpoint temporal de diagnóstico — remover una vez resuelto el bug de
// "la búsqueda de facturas de compra no trae datos".
export async function GET() {
  try {
    const count = await pool.query(`SELECT COUNT(*)::int AS n FROM compras`);
    const rows = await pool.query(
      `SELECT id, fecha, proveedor_nombre, estado, tasa_dia, created_at
       FROM compras ORDER BY id DESC LIMIT 10`
    );
    return NextResponse.json({
      totalCompras: count.rows[0].n,
      ultimas: rows.rows,
      databaseUrlHost: (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

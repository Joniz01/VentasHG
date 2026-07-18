import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gastos recurrentes cuyo próximo recordatorio ya llegó y no han sido marcados como vistos
export async function GET() {
  try {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

    const result = await pool.query(
      `SELECT id, proveedor, categoria, monto_bs, proximo_recordatorio
       FROM gastos
       WHERE recurrente = TRUE
         AND recordatorio_visto = FALSE
         AND proximo_recordatorio IS NOT NULL
         AND proximo_recordatorio <= $1
       ORDER BY proximo_recordatorio ASC`,
      [hoy]
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      proveedor: r.proveedor,
      categoria: r.categoria,
      montoBs: Number(r.monto_bs),
      proximoRecordatorio: r.proximo_recordatorio,
    }));

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    return NextResponse.json({ items: [], total: 0, error: String(err) });
  }
}

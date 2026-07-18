import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Gastos recurrentes cuyo próximo recordatorio ya llegó y no han sido marcados como vistos
export async function GET() {
  try {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

    const result = await pool.query(
      `SELECT g.id, g.proveedor, tg.nombre AS tipo_gasto_nombre, g.monto_bs, g.proximo_recordatorio
       FROM gastos g
       LEFT JOIN tipos_gasto tg ON tg.id = g.tipo_gasto_id
       WHERE g.recurrente = TRUE
         AND g.recordatorio_visto = FALSE
         AND g.proximo_recordatorio IS NOT NULL
         AND g.proximo_recordatorio <= $1
       ORDER BY g.proximo_recordatorio ASC`,
      [hoy]
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      proveedor: r.proveedor,
      tipoGastoNombre: r.tipo_gasto_nombre,
      montoBs: Number(r.monto_bs),
      proximoRecordatorio: r.proximo_recordatorio,
    }));

    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    return NextResponse.json({ items: [], total: 0, error: String(err) });
  }
}

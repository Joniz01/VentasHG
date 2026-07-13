import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Devuelve el conteo de cuentas por cobrar vencidas (pendientes con fecha_limite_pago < hoy)
export async function GET() {
  try {
    const hoy = new Date().toISOString().slice(0, 10);

    // CxC Directa vencidas
    const cxc = await pool.query(
      `SELECT COUNT(*) AS cnt FROM ventas
       WHERE cuenta_por_cobrar = TRUE
         AND cuenta_cobrada = FALSE
         AND fecha_limite_pago IS NOT NULL
         AND fecha_limite_pago < $1`,
      [hoy]
    );

    // Cashea vencidas
    const cashea = await pool.query(
      `SELECT COUNT(*) AS cnt FROM cashea_cuotas cc
       JOIN ventas v ON v.id = cc.venta_id
       WHERE cc.cobrada = FALSE
         AND cc.fecha_vencimiento IS NOT NULL
         AND cc.fecha_vencimiento < $1`,
      [hoy]
    ).catch(() => ({ rows: [{ cnt: "0" }] }));

    // Yummy vencidas
    const yummy = await pool.query(
      `SELECT COUNT(*) AS cnt FROM yummy_cuotas yc
       JOIN ventas v ON v.id = yc.venta_id
       WHERE yc.cobrada = FALSE
         AND yc.fecha_vencimiento IS NOT NULL
         AND yc.fecha_vencimiento < $1`,
      [hoy]
    ).catch(() => ({ rows: [{ cnt: "0" }] }));

    const total =
      Number(cxc.rows[0]?.cnt ?? 0) +
      Number(cashea.rows[0]?.cnt ?? 0) +
      Number(yummy.rows[0]?.cnt ?? 0);

    return NextResponse.json({ vencidas: total });
  } catch (err) {
    return NextResponse.json({ vencidas: 0, error: String(err) });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HOY = `(NOW() AT TIME ZONE 'America/Caracas')::date`;

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const montoUsdExpr = `SUM(CASE WHEN tasa_dia > 0 THEN monto_bs / tasa_dia ELSE 0 END)`;
  const montoBsExpr = `SUM(monto_bs)`;

  try {
    const hoyResult = await pool.query(
      `SELECT COALESCE(${montoUsdExpr}, 0) AS total_usd, COALESCE(${montoBsExpr}, 0) AS total_bs
       FROM gastos WHERE fecha = ${HOY}`
    );

    const mesResult = await pool.query(
      `SELECT COALESCE(${montoUsdExpr}, 0) AS total_usd, COALESCE(${montoBsExpr}, 0) AS total_bs
       FROM gastos WHERE date_trunc('month', fecha) = date_trunc('month', ${HOY})`
    );

    const pendienteResult = await pool.query(
      `SELECT COALESCE(${montoUsdExpr}, 0) AS total_usd, COALESCE(${montoBsExpr}, 0) AS total_bs
       FROM gastos WHERE estado != 'PAGADO'`
    );

    return NextResponse.json({
      gastoHoy: Number(hoyResult.rows[0]?.total_usd ?? 0),
      gastoHoyBs: Number(hoyResult.rows[0]?.total_bs ?? 0),
      gastoMes: Number(mesResult.rows[0]?.total_usd ?? 0),
      gastoMesBs: Number(mesResult.rows[0]?.total_bs ?? 0),
      pendientePorPagar: Number(pendienteResult.rows[0]?.total_usd ?? 0),
      pendientePorPagarBs: Number(pendienteResult.rows[0]?.total_bs ?? 0),
    });
  } catch {
    return NextResponse.json({ gastoHoy: 0, gastoHoyBs: 0, gastoMes: 0, gastoMesBs: 0, pendientePorPagar: 0, pendientePorPagarBs: 0 });
  }
}

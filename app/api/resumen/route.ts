import { NextRequest, NextResponse } from "next/server";
import { getResumenLocal } from "@/lib/resumen";
import { getDashboardToken } from "@/lib/dashboard-token";

// Endpoint autenticado para el dashboard consolidado.
// Acepta DASHBOARD_API_KEY (si está seteado) O el token derivado de DATABASE_URL.
// Ambas instancias que comparten la misma BD siempre coinciden en el token derivado.
export async function GET(request: NextRequest) {
  const provided =
    request.nextUrl.searchParams.get("apikey") ??
    request.headers.get("x-api-key") ??
    "";

  const validTokens = new Set<string>();
  validTokens.add(getDashboardToken());
  if (process.env.DASHBOARD_API_KEY) {
    validTokens.add(process.env.DASHBOARD_API_KEY);
  }

  if (!validTokens.has(provided)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const data = await getResumenLocal();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}

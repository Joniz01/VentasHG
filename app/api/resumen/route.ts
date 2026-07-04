import { NextRequest, NextResponse } from "next/server";
import { getResumenLocal } from "@/lib/resumen";

// Endpoint público autenticado por API key para el dashboard consolidado.
// Devuelve indicadores clave de esta instancia.
export async function GET(request: NextRequest) {
  const apiKey = process.env.DASHBOARD_API_KEY;
  if (apiKey) {
    const provided =
      request.nextUrl.searchParams.get("apikey") ??
      request.headers.get("x-api-key");
    if (provided !== apiKey) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
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

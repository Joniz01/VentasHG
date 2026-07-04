import { NextResponse } from "next/server";
import { getResumenLocal } from "@/lib/resumen";

// Endpoint interno para el dashboard consolidado.
// Expone solo métricas agregadas (totales y conteos) sin datos individuales.
export async function GET() {
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

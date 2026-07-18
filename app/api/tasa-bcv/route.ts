import { NextRequest, NextResponse } from "next/server";
import { obtenerTasaBcv } from "@/lib/bcv";

export async function GET(request: NextRequest) {
  const debug = request.nextUrl.searchParams.get("debug") === "1";

  try {
    const resultado = await obtenerTasaBcv();
    return NextResponse.json(resultado);
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo consultar la tasa BCV", ...(debug && err instanceof Error ? { detalle: err.message } : {}) },
      { status: 502 }
    );
  }
}

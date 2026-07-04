import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { getResumenLocal, ResumenData } from "@/lib/resumen";

async function fetchResumen(baseUrl: string, apiKey: string): Promise<ResumenData> {
  const url = `${baseUrl}/api/resumen${apiKey ? `?apikey=${encodeURIComponent(apiKey)}` : ""}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const empresa = baseUrl.replace(/https?:\/\//, "");
      return {
        empresa,
        hoy: { cantidad: 0, total_usd: 0 },
        semana: { cantidad: 0, total_usd: 0 },
        mes: { cantidad: 0, total_usd: 0 },
        cxcPendiente: { cantidad: 0, total_usd: 0 },
        stock: { total_productos: 0, sin_stock: 0 },
        error: `No se pudo conectar (${res.status})`,
      };
    }
    return res.json() as Promise<ResumenData>;
  } catch {
    const empresa = baseUrl.replace(/https?:\/\//, "");
    return {
      empresa,
      hoy: { cantidad: 0, total_usd: 0 },
      semana: { cantidad: 0, total_usd: 0 },
      mes: { cantidad: 0, total_usd: 0 },
      cxcPendiente: { cantidad: 0, total_usd: 0 },
      stock: { total_productos: 0, sin_stock: 0 },
      error: "Error de red al conectar",
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const sesion = await getSesionFromRequest(request);
    if (!sesion || sesion.rol !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const apiKey = process.env.DASHBOARD_API_KEY ?? "";
    const empresa2Url = process.env.EMPRESA2_URL ?? "";

    // Empresa1: query directa a la DB (sin HTTP, sin API key)
    const empresa1Promise = getResumenLocal().catch(() => ({
      empresa: process.env.EMPRESA_NOMBRE ?? "Empresa",
      hoy: { cantidad: 0, total_usd: 0 },
      semana: { cantidad: 0, total_usd: 0 },
      mes: { cantidad: 0, total_usd: 0 },
      cxcPendiente: { cantidad: 0, total_usd: 0 },
      stock: { total_productos: 0, sin_stock: 0 },
      error: "Error al consultar base de datos",
    } as ResumenData));

    const fetches: Promise<ResumenData>[] = [empresa1Promise];
    if (empresa2Url) {
      fetches.push(fetchResumen(empresa2Url, apiKey));
    }

    const empresas = await Promise.all(fetches);

    return NextResponse.json({ empresas });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del dashboard" },
      { status: 500 }
    );
  }
}

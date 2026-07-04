import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { getResumenLocal, ResumenData } from "@/lib/resumen";
async function fetchResumen(baseUrl: string): Promise<ResumenData> {
  const empresa = baseUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
  const empty = (): ResumenData => ({
    empresa,
    hoy: { cantidad: 0, total_usd: 0 },
    semana: { cantidad: 0, total_usd: 0 },
    mes: { cantidad: 0, total_usd: 0 },
    cxcPendiente: { cantidad: 0, total_usd: 0 },
    stock: { total_productos: 0, sin_stock: 0 },
  });

  try {
    const res = await fetch(`${baseUrl}/api/resumen`, { cache: "no-store" });
    if (!res.ok) {
      return { ...empty(), error: `No se pudo conectar (${res.status})` };
    }
    return (await res.json()) as ResumenData;
  } catch {
    return { ...empty(), error: "Error de red al conectar" };
  }
}

export async function GET(request: NextRequest) {
  try {
    const sesion = await getSesionFromRequest(request);
    if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.dashboard)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const empresa2Url = process.env.EMPRESA2_URL ?? "";

    const empresa1Promise = getResumenLocal().catch(
      (): ResumenData => ({
        empresa: process.env.EMPRESA_NOMBRE ?? "Empresa",
        hoy: { cantidad: 0, total_usd: 0 },
        semana: { cantidad: 0, total_usd: 0 },
        mes: { cantidad: 0, total_usd: 0 },
        cxcPendiente: { cantidad: 0, total_usd: 0 },
        stock: { total_productos: 0, sin_stock: 0 },
        error: "Error al consultar base de datos",
      })
    );

    const fetches: Promise<ResumenData>[] = [empresa1Promise];
    if (empresa2Url) {
      fetches.push(fetchResumen(empresa2Url));
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

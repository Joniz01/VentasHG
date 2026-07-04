import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { getResumenLocal, ResumenData } from "@/lib/resumen";

async function fetchResumen(baseUrl: string, apiKey: string): Promise<ResumenData> {
  const empresa = baseUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
  const empty = (): ResumenData => ({
    empresa,
    hoy: { cantidad: 0, total_usd: 0 },
    semana: { cantidad: 0, total_usd: 0 },
    mes: { cantidad: 0, total_usd: 0 },
    cxcPendiente: { cantidad: 0, total_usd: 0 },
    stock: { total_productos: 0, sin_stock: 0 },
  });

  const tryFetch = async (withKey: boolean): Promise<Response | null> => {
    const qs = withKey && apiKey ? `?apikey=${encodeURIComponent(apiKey)}` : "";
    try {
      return await fetch(`${baseUrl}/api/resumen${qs}`, { cache: "no-store" });
    } catch {
      return null;
    }
  };

  // Intenta con API key primero; si falla con 401/403, reintenta sin key
  let res = await tryFetch(true);
  if (res && (res.status === 401 || res.status === 403) && apiKey) {
    res = await tryFetch(false);
  }

  if (!res) return { ...empty(), error: "Error de red al conectar" };
  if (!res.ok) return { ...empty(), error: `No se pudo conectar (${res.status})` };

  try {
    return (await res.json()) as ResumenData;
  } catch {
    return { ...empty(), error: "Respuesta inválida del servidor" };
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

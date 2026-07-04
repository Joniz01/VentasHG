import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";

type ResumenEmpresa = {
  empresa: string;
  hoy: { cantidad: number; total_usd: number };
  semana: { cantidad: number; total_usd: number };
  mes: { cantidad: number; total_usd: number };
  cxcPendiente: { cantidad: number; total_usd: number };
  stock: { total_productos: number; sin_stock: number };
  error?: string;
};

async function fetchResumen(baseUrl: string, apiKey: string): Promise<ResumenEmpresa> {
  const url = `${baseUrl}/api/resumen?apikey=${encodeURIComponent(apiKey)}`;
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
    return res.json() as Promise<ResumenEmpresa>;
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

    // Usar EMPRESA1_URL si está definido; si no, derivar del request entrante
    // para evitar problemas con VERCEL_URL apuntando al deploy preview en lugar de producción
    const reqOrigin = new URL(request.url).origin;
    const empresa1Url = process.env.EMPRESA1_URL ?? reqOrigin;
    const empresa2Url = process.env.EMPRESA2_URL ?? "";

    const fetches: Promise<ResumenEmpresa>[] = [
      fetchResumen(empresa1Url, apiKey),
    ];
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

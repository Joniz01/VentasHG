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
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const apiKey = process.env.DASHBOARD_API_KEY ?? "";
  const empresa1Url = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const empresa2Url = process.env.EMPRESA2_URL ?? "";

  const fetches: Promise<ResumenEmpresa>[] = [
    fetchResumen(empresa1Url, apiKey),
  ];
  if (empresa2Url) {
    fetches.push(fetchResumen(empresa2Url, apiKey));
  }

  const empresas = await Promise.all(fetches);

  return NextResponse.json({ empresas });
}

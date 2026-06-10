import { NextRequest, NextResponse } from "next/server";

const MESES: Record<string, string> = {
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12",
};

function parseFechaValorBcv(texto: string): string | null {
  const match = texto.match(/(\d{1,2})\s+de\s+([a-zA-Zá-ú]+)\s+de\s+(\d{4})|(\d{1,2})\s+([a-zA-Zá-ú]+)\s+(\d{4})/i);
  if (!match) return null;

  const [, dia1, mes1, anio1, dia2, mes2, anio2] = match;
  const dia = dia1 ?? dia2;
  const mes = (mes1 ?? mes2).toLowerCase();
  const anio = anio1 ?? anio2;
  const mesNum = MESES[mes];

  if (!mesNum) return null;

  return `${anio}-${mesNum}-${dia.padStart(2, "0")}`;
}

async function fromBcvOrgVe() {
  const res = await fetch("https://www.bcv.org.ve/", {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`bcv.org.ve respondió con estado ${res.status}`);
  }

  const html = await res.text();

  const dolarSection = html.match(/id="dolar"[\s\S]*?<\/div>\s*<\/div>/);
  if (!dolarSection) {
    throw new Error("No se encontró la sección del dólar en bcv.org.ve");
  }

  const valorMatch = dolarSection[0].match(/<strong>\s*([\d.,]+)\s*<\/strong>/);
  if (!valorMatch) {
    throw new Error("No se encontró el valor del dólar en bcv.org.ve");
  }

  const tasa = Number(valorMatch[1].replace(/\./g, "").replace(",", "."));

  if (Number.isNaN(tasa) || tasa <= 0) {
    throw new Error("Respuesta inválida de bcv.org.ve");
  }

  const fechaMatch = html.match(/date-display-single[^>]*>([^<]+)</);
  const fecha = fechaMatch ? parseFechaValorBcv(fechaMatch[1]) : null;

  return { tasa, fecha };
}

async function fromRafnixg() {
  const res = await fetch("https://bcv-api.rafnixg.dev/rates/", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`bcv-api.rafnixg.dev respondió con estado ${res.status}`);
  }

  const data = await res.json();
  const tasa = Number(data?.dollar);

  if (Number.isNaN(tasa) || tasa <= 0) {
    throw new Error("Respuesta inválida de bcv-api.rafnixg.dev");
  }

  return { tasa, fecha: data?.date ?? null };
}

async function fromPyDolarVenezuela() {
  const res = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`pyDolarVenezuela respondió con estado ${res.status}`);
  }

  const data = await res.json();
  const tasa = Number(data?.monitors?.bcv?.price);

  if (Number.isNaN(tasa) || tasa <= 0) {
    throw new Error("Respuesta inválida de pyDolarVenezuela");
  }

  return { tasa, fecha: data?.monitors?.bcv?.last_update ?? null };
}

async function fromDolarApi() {
  const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`DolarApi respondió con estado ${res.status}`);
  }

  const data = await res.json();
  const tasa = Number(data.promedio);

  if (Number.isNaN(tasa) || tasa <= 0) {
    throw new Error("Respuesta inválida de DolarApi");
  }

  return { tasa, fecha: data.fechaActualizacion };
}

export async function GET(request: NextRequest) {
  // Se prioriza el scraping directo de bcv.org.ve porque refleja la última
  // tasa publicada (incluso si ya corresponde al día siguiente). Las demás
  // fuentes son respaldo en caso de que bcv.org.ve bloquee la solicitud.
  const fuentes: { nombre: string; fn: () => Promise<{ tasa: number; fecha: string | null }> }[] = [
    { nombre: "bcv.org.ve", fn: fromBcvOrgVe },
    { nombre: "bcv-api.rafnixg.dev", fn: fromRafnixg },
    { nombre: "pyDolarVenezuela", fn: fromPyDolarVenezuela },
    { nombre: "DolarApi", fn: fromDolarApi },
  ];

  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const errores: Record<string, string> = {};

  for (const fuente of fuentes) {
    try {
      const resultado = await fuente.fn();
      return NextResponse.json(
        debug ? { ...resultado, fuente: fuente.nombre, errores } : resultado
      );
    } catch (err) {
      errores[fuente.nombre] = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json(
    { error: "No se pudo consultar la tasa BCV", ...(debug ? { errores } : {}) },
    { status: 502 }
  );
}

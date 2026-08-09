import https from "node:https";

const NAVEGADOR_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type TasaBcv = { tasa: number; fecha: string | null };

// bcv.org.ve sirve un certificado SSL inválido/autofirmado, por lo que el
// fetch de Node lo rechaza con "fetch failed". Se usa https.request con
// rejectUnauthorized desactivado, igual que hacen los scrapers conocidos.
function fetchBcvOrgVeHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      "https://www.bcv.org.ve/",
      {
        headers: { "User-Agent": NAVEGADOR_USER_AGENT },
        rejectUnauthorized: false,
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      }
    );

    req.on("timeout", () => req.destroy(new Error("Tiempo de espera agotado")));
    req.on("error", reject);
  });
}

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

async function fromBcvOrgVe(): Promise<TasaBcv> {
  const html = await fetchBcvOrgVeHtml();

  const dolarIndex = html.indexOf('id="dolar"');
  if (dolarIndex === -1) {
    throw new Error("No se encontró la sección del dólar en bcv.org.ve");
  }

  const dolarSection = html.slice(dolarIndex, dolarIndex + 1500);

  const valorMatch = dolarSection.match(/<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/);
  if (!valorMatch) {
    throw new Error(
      `No se encontró el valor del dólar en bcv.org.ve. Sección: ${dolarSection.replace(/\s+/g, " ").slice(0, 400)}`
    );
  }

  const tasa = Number(valorMatch[1].replace(/\./g, "").replace(",", "."));

  if (Number.isNaN(tasa) || tasa <= 0) {
    throw new Error("Respuesta inválida de bcv.org.ve");
  }

  const fechaMatch = html.match(/date-display-single[^>]*>([^<]+)</);
  const fecha = fechaMatch ? parseFechaValorBcv(fechaMatch[1]) : null;

  return { tasa, fecha };
}

async function fromPyDolarVenezuela(): Promise<TasaBcv> {
  const res = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv", {
    cache: "no-store",
    headers: { "User-Agent": NAVEGADOR_USER_AGENT },
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

async function fromDolarApi(): Promise<TasaBcv> {
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

// Se prioriza el scraping directo de bcv.org.ve porque refleja la última
// tasa publicada (incluso si ya corresponde al día siguiente). Las demás
// fuentes son respaldo en caso de que bcv.org.ve bloquee la solicitud.
// bcv-api.rafnixg.dev fue retirado: su dominio ya no resuelve en DNS (confirmado en producción).
const FUENTES_BCV: { nombre: string; fn: () => Promise<TasaBcv> }[] = [
  { nombre: "bcv.org.ve", fn: fromBcvOrgVe },
  { nombre: "pyDolarVenezuela", fn: fromPyDolarVenezuela },
  { nombre: "DolarApi", fn: fromDolarApi },
];

export async function obtenerTasaBcv(): Promise<TasaBcv> {
  const errores: Record<string, string> = {};
  for (const fuente of FUENTES_BCV) {
    try {
      return await fuente.fn();
    } catch (err) {
      errores[fuente.nombre] = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`No se pudo consultar la tasa BCV: ${JSON.stringify(errores)}`);
}

function restarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

function describirErrorFetch(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    const causaTexto = cause instanceof Error ? cause.message : cause ? String(cause) : "";
    return causaTexto ? `${err.message} (${causaTexto})` : err.message;
  }
  return String(err);
}

// Extrae {tasa, fecha} de una entrada de historial probando varias claves posibles
function leerEntradaHistorial(it: Record<string, unknown>): { tasa: number; fecha: string } | null {
  const tasa = Number(it.price ?? it.promedio ?? it.dollar ?? it.tasa ?? it.value);
  const fechaRaw = it.date ?? it.fecha ?? it.last_update;
  if (Number.isNaN(tasa) || tasa <= 0 || typeof fechaRaw !== "string") return null;
  return { tasa, fecha: fechaRaw.slice(0, 10) };
}

/**
 * Consulta la tasa BCV histórica de una fecha específica (YYYY-MM-DD) vía pyDolarVenezuela (pydolarve.org).
 * bcv-api.rafnixg.dev fue descartado: su dominio ya no resuelve en DNS (verificado en producción).
 * El formato exacto de la API v2 de pydolarve.org no está oficialmente documentado con ejemplos,
 * por lo que se prueban dos variantes de parámetros conocidas por el patrón de su v1 (?page=bcv).
 * Si el día exacto no tiene publicación (fin de semana/feriado), se toma la fecha más cercana anterior.
 */
export async function obtenerTasaBcvPorFecha(fecha: string): Promise<TasaBcv> {
  const startDate = restarDias(fecha, 10);
  const intentos = [
    `https://pydolarve.org/api/v2/dollar/history?page=bcv&start_date=${startDate}&end_date=${fecha}`,
    `https://pydolarve.org/api/v1/dollar/history?page=bcv&start_date=${startDate}&end_date=${fecha}`,
  ];

  const errores: string[] = [];

  for (const url of intentos) {
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store", headers: { "User-Agent": NAVEGADOR_USER_AGENT } });
    } catch (err) {
      errores.push(`${url}: ${describirErrorFetch(err)}`);
      continue;
    }

    if (!res.ok) {
      errores.push(`${url}: HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const candidatos: unknown =
      (Array.isArray(data) && data) || data?.data || data?.history || data?.monitors?.bcv || null;
    const entradas: Record<string, unknown>[] = Array.isArray(candidatos) ? candidatos : [];

    let mejor: { tasa: number; fecha: string } | null = null;
    for (const it of entradas) {
      const leida = leerEntradaHistorial(it);
      if (!leida || leida.fecha > fecha) continue;
      if (!mejor || leida.fecha > mejor.fecha) mejor = leida;
    }

    if (mejor) return mejor;
    errores.push(`${url}: respuesta sin entradas utilizables (${JSON.stringify(data).slice(0, 200)})`);
  }

  throw new Error(`No se pudo obtener la tasa BCV histórica de ${fecha}: ${errores.join(" | ")}`);
}

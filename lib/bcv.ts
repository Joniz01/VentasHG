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

async function fromRafnixg(): Promise<TasaBcv> {
  const res = await fetch("https://bcv-api.rafnixg.dev/rates/", {
    cache: "no-store",
    headers: { "User-Agent": NAVEGADOR_USER_AGENT },
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
const FUENTES_BCV: { nombre: string; fn: () => Promise<TasaBcv> }[] = [
  { nombre: "bcv.org.ve", fn: fromBcvOrgVe },
  { nombre: "bcv-api.rafnixg.dev", fn: fromRafnixg },
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

/**
 * Consulta la tasa BCV histórica de una fecha específica (YYYY-MM-DD) vía bcv-api.rafnixg.dev.
 * Endpoint confirmado: GET /rates/{fecha} → { dollar, date }; responde 404 si el BCV
 * no publicó ese día exacto (fin de semana/feriado). En ese caso se busca en
 * /rates/history el día hábil más reciente igual o anterior a la fecha pedida.
 */
function describirErrorFetch(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    const causaTexto = cause instanceof Error ? cause.message : cause ? String(cause) : "";
    return causaTexto ? `${err.message} (${causaTexto})` : err.message;
  }
  return String(err);
}

export async function obtenerTasaBcvPorFecha(fecha: string): Promise<TasaBcv> {
  let resDia: Response;
  try {
    resDia = await fetch(`https://bcv-api.rafnixg.dev/rates/${fecha}`, {
      cache: "no-store",
      headers: { "User-Agent": NAVEGADOR_USER_AGENT },
    });
  } catch (err) {
    throw new Error(`No se pudo conectar a bcv-api.rafnixg.dev/rates/${fecha}: ${describirErrorFetch(err)}`);
  }

  if (resDia.ok) {
    const data = await resDia.json();
    const tasa = Number(data?.dollar);
    if (!Number.isNaN(tasa) && tasa > 0) {
      return { tasa, fecha: (data?.date ?? fecha).slice(0, 10) };
    }
  } else if (resDia.status !== 404) {
    throw new Error(`bcv-api.rafnixg.dev /rates/${fecha} respondió con estado ${resDia.status}`);
  }

  // Sin dato exacto (404): buscar el día hábil más cercano anterior en el historial
  const startDate = restarDias(fecha, 10);
  let resHist: Response;
  try {
    resHist = await fetch(
      `https://bcv-api.rafnixg.dev/rates/history?start_date=${startDate}&end_date=${fecha}`,
      { cache: "no-store", headers: { "User-Agent": NAVEGADOR_USER_AGENT } }
    );
  } catch (err) {
    throw new Error(`No se pudo conectar a bcv-api.rafnixg.dev/rates/history: ${describirErrorFetch(err)}`);
  }

  if (!resHist.ok) {
    throw new Error(`bcv-api.rafnixg.dev /rates/history respondió con estado ${resHist.status}`);
  }

  const hist = await resHist.json();
  const rates: { dollar: number; date: string }[] = Array.isArray(hist?.rates) ? hist.rates : [];

  let mejor: { tasa: number; fecha: string } | null = null;
  for (const r of rates) {
    const f = String(r.date).slice(0, 10);
    const t = Number(r.dollar);
    if (Number.isNaN(t) || t <= 0 || f > fecha) continue;
    if (!mejor || f > mejor.fecha) mejor = { tasa: t, fecha: f };
  }

  if (mejor) return mejor;

  throw new Error(`No hay tasa BCV publicada cerca de ${fecha} en bcv-api.rafnixg.dev`);
}

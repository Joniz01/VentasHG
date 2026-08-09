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

// Busca un número (precio/tasa) dentro de un objeto probando varias claves comunes
function extraerNumero(obj: Record<string, unknown>, claves: string[]): number | null {
  for (const clave of claves) {
    const v = obj[clave];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function extraerFecha(obj: Record<string, unknown>, claves: string[]): string | null {
  for (const clave of claves) {
    const v = obj[clave];
    if (typeof v === "string" && v.trim()) return v.slice(0, 10);
  }
  return null;
}

// Encuentra en un array de entradas históricas la más cercana (igual o anterior) a la fecha pedida
function entradaMasCercana(
  entradas: Record<string, unknown>[],
  fecha: string
): { tasa: number; fecha: string } | null {
  let mejor: { tasa: number; fecha: string } | null = null;
  for (const it of entradas) {
    const f = extraerFecha(it, ["fecha", "date", "last_update", "created_at"]);
    const t = extraerNumero(it, ["price", "promedio", "tasa", "value", "monto"]);
    if (!f || !t) continue;
    if (f > fecha) continue; // solo fechas iguales o anteriores a la pedida
    if (!mejor || f > mejor.fecha) mejor = { tasa: t, fecha: f };
  }
  return mejor;
}

/**
 * Consulta la tasa BCV histórica de una fecha específica (YYYY-MM-DD) vía pyDolarVenezuela.
 * Si el BCV no publicó ese día exacto (fin de semana/feriado), retorna la tasa del
 * día hábil más reciente igual o anterior a la fecha pedida.
 */
export async function obtenerTasaBcvPorFecha(fecha: string): Promise<TasaBcv> {
  const res = await fetch(
    `https://pydolarve.org/api/v2/dollar/history?monitor=bcv&start_date=${fecha}&end_date=${fecha}`,
    { cache: "no-store", headers: { "User-Agent": NAVEGADOR_USER_AGENT } }
  );

  if (!res.ok) {
    throw new Error(`pyDolarVenezuela history respondió con estado ${res.status}`);
  }

  const data = await res.json();

  // El formato exacto de respuesta no está confirmado; se prueban varias formas comunes
  const candidatosArray: unknown =
    (Array.isArray(data) && data) ||
    data?.data ||
    data?.history ||
    data?.monitors?.bcv?.history ||
    data?.monitors?.bcv ||
    null;

  const entradas: Record<string, unknown>[] = Array.isArray(candidatosArray)
    ? (candidatosArray as Record<string, unknown>[])
    : [];

  if (entradas.length > 0) {
    const mejor = entradaMasCercana(entradas, fecha);
    if (mejor) return { tasa: mejor.tasa, fecha: mejor.fecha };
  }

  // Respuesta de un solo objeto (no array) con el valor del día
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const t = extraerNumero(data, ["price", "promedio", "tasa", "value"]);
    if (t) {
      const f = extraerFecha(data, ["fecha", "date", "last_update"]) ?? fecha;
      return { tasa: t, fecha: f };
    }
  }

  throw new Error(
    `Respuesta inesperada de pyDolarVenezuela history: ${JSON.stringify(data).slice(0, 300)}`
  );
}

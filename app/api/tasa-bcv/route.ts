import { NextResponse } from "next/server";

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

export async function GET() {
  // Fuentes que reflejan la tasa publicada en bcv.org.ve, en orden de preferencia.
  const fuentes = [fromRafnixg, fromPyDolarVenezuela, fromDolarApi];

  for (const fuente of fuentes) {
    try {
      const resultado = await fuente();
      return NextResponse.json(resultado);
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "No se pudo consultar la tasa BCV" },
    { status: 502 }
  );
}

import { NextResponse } from "next/server";

export async function GET() {
  // Fuente principal: pyDolarVenezuela, hace scraping directo de bcv.org.ve
  // y refleja la tasa publicada en el sitio en tiempo real.
  try {
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

    return NextResponse.json({
      tasa,
      fecha: data?.monitors?.bcv?.last_update ?? null,
    });
  } catch {
    // Fuente alternativa
    try {
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

      return NextResponse.json({ tasa, fecha: data.fechaActualizacion });
    } catch {
      return NextResponse.json(
        { error: "No se pudo consultar la tasa BCV" },
        { status: 502 }
      );
    }
  }
}


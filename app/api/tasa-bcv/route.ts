import { NextResponse } from "next/server";

export async function GET() {
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

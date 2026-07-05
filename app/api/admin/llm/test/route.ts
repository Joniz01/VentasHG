import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { callLLM } from "@/lib/llm/llm-service";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const result = await callLLM("Responde solo con la palabra: OK", {
      maxTokens: 10,
      context: "admin-test",
    });
    return NextResponse.json({ ok: true, provider: result.provider, text: result.text.trim() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

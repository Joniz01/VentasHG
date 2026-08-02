import { NextRequest, NextResponse } from "next/server";
import { getConteoFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getConteoFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.json({ conteoUsuario: sesion });
}

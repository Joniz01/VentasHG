import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";
import { decryptKey } from "@/lib/llm/llm-config";

type Params = { params: Promise<{ id: string }> };

// Revela el valor completo de una API key bajo demanda (nunca se incluye en el
// listado general de /api/admin/llm/keys). Solo ADMIN.
export async function GET(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(`SELECT api_key FROM llm_api_keys WHERE id = $1`, [id]);
  if (!result.rows[0]) {
    return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  }

  try {
    const api_key = decryptKey(result.rows[0].api_key);
    return NextResponse.json({ api_key });
  } catch {
    return NextResponse.json({ error: "No se pudo descifrar la key (¿cambió LLM_ENCRYPTION_KEY?)" }, { status: 500 });
  }
}

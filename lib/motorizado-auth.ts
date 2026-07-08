import { NextRequest } from "next/server";
import { getMotorizadoIdFromSession } from "@/lib/auth";

/**
 * Extrae el motorizado_id desde:
 * 1. Header: Authorization: Bearer <token>
 * 2. Cookie: vhg_motorizado_session (compatibilidad web)
 */
export async function getMotorizadoIdFromRequest(request: NextRequest): Promise<number | null> {
  // Bearer token (app móvil)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return token ? getMotorizadoIdFromSession(token) : null;
  }

  // Cookie (web delivery)
  const cookie = request.cookies.get("vhg_motorizado_session")?.value;
  return cookie ? getMotorizadoIdFromSession(cookie) : null;
}

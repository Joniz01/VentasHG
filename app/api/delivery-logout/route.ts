import { NextRequest, NextResponse } from "next/server";
import { MOTORIZADO_SESSION_COOKIE, deleteMotorizadoSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(MOTORIZADO_SESSION_COOKIE)?.value;
  if (token) {
    await deleteMotorizadoSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MOTORIZADO_SESSION_COOKIE);
  return response;
}

import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSession,
  getAdminPasswordHash,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  const password = body.password ?? "";

  const hash = await getAdminPasswordHash();
  if (!hash || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

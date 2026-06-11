import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSession,
  getAdminPasswordHash,
  setAdminPassword,
  verifyPassword,
} from "@/lib/auth";

export async function GET() {
  const hash = await getAdminPasswordHash();
  return NextResponse.json({ configured: hash !== null });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  const newPassword = body.newPassword?.trim() ?? "";
  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 }
    );
  }

  const currentHash = await getAdminPasswordHash();

  if (currentHash) {
    const currentPassword = body.currentPassword ?? "";
    if (!verifyPassword(currentPassword, currentHash)) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 401 }
      );
    }
  }

  await setAdminPassword(newPassword);

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

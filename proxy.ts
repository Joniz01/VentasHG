import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isSessionValid } from "@/lib/auth";

export default async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (token && (await isSessionValid(token))) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/admin", request.url));
}

export const config = {
  matcher: [
    "/((?!admin|api/admin|delivery|api/delivery|_next/static|_next/image|favicon.ico|logo.jpg).*)",
  ],
};

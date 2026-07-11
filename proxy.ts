import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";
import type { PermisoTab } from "@/lib/types";

const PAGE_PERMISOS: { prefix: string; permiso: PermisoTab }[] = [
  { prefix: "/productos", permiso: "productos" },
  { prefix: "/ventas", permiso: "ventas" },
  { prefix: "/reportes", permiso: "reportes" },
  { prefix: "/pedidos-pendientes", permiso: "pedidosPendientes" },
];

const API_PERMISOS: { prefix: string; permiso: PermisoTab }[] = [
  { prefix: "/api/productos", permiso: "productos" },
  { prefix: "/api/categorias", permiso: "productos" },
  { prefix: "/api/extras", permiso: "productos" },
  { prefix: "/api/ventas", permiso: "ventas" },
  { prefix: "/api/clientes", permiso: "ventas" },
  { prefix: "/api/tasa-bcv", permiso: "ventas" },
  { prefix: "/api/reportes", permiso: "reportes" },
  { prefix: "/api/pedidos-pendientes", permiso: "pedidosPendientes" },
];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) {
    if (isApi) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (sesion.rol === "ADMIN") {
    return NextResponse.next();
  }

  const mapping = isApi ? API_PERMISOS : PAGE_PERMISOS;
  const match = mapping.find((m) => pathname.startsWith(m.prefix));

  if (match && !sesion.permisos[match.permiso]) {
    if (isApi) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/sin-acceso", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!admin|api/login|api/logout|api/usuarios|api/alarmas-config|delivery|api/delivery|api/motorizado|sin-acceso|_next/static|_next/image|favicon.ico|logo.jpg).*)",
  ],
};

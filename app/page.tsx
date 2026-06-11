import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";
import { PERMISO_TABS } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERMISO_PATHS: Record<string, string> = {
  productos: "/productos",
  ventas: "/ventas",
  reportes: "/reportes",
  pedidosPendientes: "/pedidos-pendientes",
};

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) {
    redirect("/admin");
  }

  if (sesion.rol === "ADMIN") {
    redirect("/productos");
  }

  const primeraTab = PERMISO_TABS.find((tab) => sesion.permisos[tab.key]);
  if (!primeraTab) {
    redirect("/sin-acceso");
  }

  redirect(PERMISO_PATHS[primeraTab.key]);
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";
import ConfiguracionClient from "@/components/ConfiguracionClient";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) redirect("/admin");
  if (sesion.rol !== "ADMIN") redirect("/sin-acceso");

  return <ConfiguracionClient />;
}

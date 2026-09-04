import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";
import ConteoProgramacionClient from "@/components/ConteoProgramacionClient";

export const dynamic = "force-dynamic";

export default async function ConteoProgramacionPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) redirect("/admin");

  const canView = sesion.rol === "ADMIN" || sesion.permisos.programarConteo || sesion.permisos.autorizarConteo;
  if (!canView) redirect("/sin-acceso");

  const canEdit = sesion.rol === "ADMIN" || sesion.permisos.programarConteo;

  return <ConteoProgramacionClient canEdit={canEdit} />;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";
import SinAccesoClient from "@/components/SinAccesoClient";

export const dynamic = "force-dynamic";

export default async function SinAccesoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">Sin permisos asignados</h2>
      <p className="text-sm text-zinc-600">
        Tu cuenta no tiene acceso a ninguna sección. Contacta al administrador del sistema para
        que te asigne los permisos correspondientes.
      </p>
      <SinAccesoClient />
    </div>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getUsuarioFromSession, hasAnyUsuario } from "@/lib/auth";
import LoginClient from "@/components/LoginClient";
import AdminTabsClient from "@/components/AdminTabsClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (sesion && sesion.rol !== "ADMIN") {
    redirect("/");
  }

  if (sesion && sesion.rol === "ADMIN") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <h2 className="text-lg font-semibold">Administración</h2>
        <AdminTabsClient
          usuarioActualId={sesion.id}
          nombre={sesion.nombre}
          usuario={sesion.usuario}
        />
      </div>
    );
  }

  const hayUsuarios = await hasAnyUsuario();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h2 className="text-lg font-semibold">Administración</h2>
      <p className="text-sm text-zinc-600">
        {hayUsuarios
          ? "Inicia sesión con tu cuenta para acceder al sistema."
          : "Configura la cuenta de administrador para proteger el acceso al sistema."}
      </p>
      <LoginClient hayUsuarios={hayUsuarios} />
    </div>
  );
}

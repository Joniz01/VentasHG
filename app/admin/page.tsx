import { cookies } from "next/headers";
import { SESSION_COOKIE, getAdminPasswordHash, isSessionValid } from "@/lib/auth";
import AdminClient from "@/components/AdminClient";
import AlarmasConfigClient from "@/components/AlarmasConfigClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const authenticated = token ? await isSessionValid(token) : false;
  const configured = (await getAdminPasswordHash()) !== null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Administración</h2>
        <p className="mb-4 text-sm text-zinc-600">
          {configured
            ? "Configura el acceso al sistema."
            : "Configura una contraseña para proteger el acceso al sistema."}
        </p>
        <AdminClient configured={configured} authenticated={authenticated} />
      </div>

      {authenticated && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Configuración de Alarmas</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Configura el sonido y comportamiento de las alarmas de Pedidos Pendientes.
          </p>
          <AlarmasConfigClient />
        </div>
      )}
    </div>
  );
}

import { cookies } from "next/headers";
import { MOTORIZADO_SESSION_COOKIE, getMotorizadoIdFromSession } from "@/lib/auth";
import DeliveryLoginClient from "@/components/DeliveryLoginClient";
import DeliveryClient from "@/components/DeliveryClient";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(MOTORIZADO_SESSION_COOKIE)?.value;
  const motorizadoId = token ? await getMotorizadoIdFromSession(token) : null;

  if (!motorizadoId) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div>
          <h2 className="mb-4 text-lg font-semibold">Delivery</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Ingresa con tu usuario de motorizado para ver tus pedidos asignados.
          </p>
        </div>
        <DeliveryLoginClient />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Delivery</h2>
      <DeliveryClient />
    </div>
  );
}

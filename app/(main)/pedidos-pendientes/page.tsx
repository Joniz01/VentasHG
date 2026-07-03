import PedidosPendientesClient from "@/components/PedidosPendientesClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PedidosPendientesPage() {
  await requirePermiso("pedidosPendientes");

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Pedidos Pendientes</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Pedidos con despacho pendiente, alertas de preparación y entrega.
      </p>
      <PedidosPendientesClient />
    </div>
  );
}

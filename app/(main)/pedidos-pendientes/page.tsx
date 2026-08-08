import Link from "next/link";
import PedidosPendientesClient from "@/components/PedidosPendientesClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PedidosPendientesPage() {
  await requirePermiso("pedidosPendientes");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Pedidos Pendientes</h2>
          <p className="text-sm text-zinc-600">
            Pedidos con despacho pendiente, alertas de preparación y entrega.
          </p>
        </div>
        <Link
          href="/comandera"
          target="_blank"
          className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
        >
          🖥️ Ver Como Comandera
        </Link>
      </div>
      <PedidosPendientesClient />
    </div>
  );
}

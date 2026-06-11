import PedidosPendientesClient from "@/components/PedidosPendientesClient";

export const dynamic = "force-dynamic";

export default function PedidosPendientesPage() {
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

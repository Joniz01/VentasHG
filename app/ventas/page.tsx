import VentasClient from "@/components/VentasClient";

export const dynamic = "force-dynamic";

export default function VentasPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Ventas</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Registra cada venta con sus productos, costo total y forma de pago.
      </p>
      <VentasClient />
    </div>
  );
}

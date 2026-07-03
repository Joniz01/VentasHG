import VentasClient from "@/components/VentasClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const sesion = await requirePermiso("ventas");

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Ventas</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Registra cada venta con sus productos, costo total y forma de pago.
      </p>
      <VentasClient rol={sesion.rol} />
    </div>
  );
}

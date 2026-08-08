import { requirePermiso } from "@/lib/auth";
import NominaClient from "@/components/NominaClient";

export const dynamic = "force-dynamic";

export default async function NominaPage() {
  await requirePermiso("gastos");

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Nómina
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            Nómina
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Empleados, períodos de pago e incidencias (Cesta Ticket, Seguro Social, Pensiones)
          </p>
        </div>
      </div>

      <NominaClient />
    </div>
  );
}

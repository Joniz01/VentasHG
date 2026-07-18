import { requirePermiso } from "@/lib/auth";
import GastosClient from "@/components/GastosClient";

export const dynamic = "force-dynamic";

export default async function NominaPage() {
  await requirePermiso("gastos");

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Nómina & Gastos
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            Nómina & Gastos Operativos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Registro de gastos de materia prima y operación. El módulo de Nómina de empleados estará disponible próximamente.
          </p>
        </div>
      </div>

      <GastosClient />

      <div
        className="mt-6 rounded-xl border p-6 text-center"
        style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
      >
        <div className="text-3xl mb-2">👷</div>
        <h2 className="text-sm font-bold mb-1" style={{ color: "var(--erp-text)" }}>
          Nómina de empleados — Próximamente
        </h2>
        <p className="text-xs max-w-sm mx-auto" style={{ color: "var(--erp-text-2)" }}>
          Registro de empleados, períodos de pago (semanal/quincenal/mensual) e incidencias
          (Cesta Ticket, Seguro Social, Pensiones) por empleado.
        </p>
      </div>
    </div>
  );
}

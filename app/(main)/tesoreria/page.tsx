import { requirePermiso } from "@/lib/auth";
import TesoreriaClient from "@/components/TesoreriaClient";

export const dynamic = "force-dynamic";

export default async function TesoreriaPage() {
  await requirePermiso("gastos");

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Tesorería
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            Planificación de Pagos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Vista consolidada de obligaciones: nóminas, gastos operativos y compromisos próximos
          </p>
        </div>
      </div>

      <TesoreriaClient />
    </div>
  );
}

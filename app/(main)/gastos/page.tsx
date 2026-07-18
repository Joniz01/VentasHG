import { requirePermiso } from "@/lib/auth";
import GastosClient from "@/components/GastosClient";

export const dynamic = "force-dynamic";

export default async function GastosPage() {
  await requirePermiso("gastos");

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Gastos
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            Gastos Operativos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Registro de gastos de materia prima y operación del negocio
          </p>
        </div>
      </div>

      <GastosClient />
    </div>
  );
}

import { requirePermiso } from "@/lib/auth";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePermiso("reportes");

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Dashboard Consolidado</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Indicadores en tiempo real de todas las empresas.
      </p>
      <DashboardClient />
    </div>
  );
}

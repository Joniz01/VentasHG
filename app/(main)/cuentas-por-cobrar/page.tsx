import CuentasPorCobrarPanel from "@/components/CuentasPorCobrarPanel";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CuentasPorCobrarPage() {
  await requirePermiso("reportes");

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold" style={{ color: "var(--erp-text)" }}>
        Cuentas por Cobrar
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--erp-text-2)" }}>
        Ventas pendientes de cobro: CxC Directa, Cashea y Yummy.
      </p>
      <CuentasPorCobrarPanel />
    </div>
  );
}

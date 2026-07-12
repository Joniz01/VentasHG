import { requirePermiso } from "@/lib/auth";
import ComprasLanding from "@/components/ComprasLanding";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  await requirePermiso("compras");
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold" style={{ color: "var(--erp-text)" }}>Compras</h2>
      <p className="mb-5 text-sm" style={{ color: "var(--erp-text-2)" }}>Registra facturas de proveedores o gestiona órdenes de compra.</p>
      <ComprasLanding />
    </div>
  );
}

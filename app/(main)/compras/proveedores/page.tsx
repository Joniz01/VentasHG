import ProveedoresPanel from "@/components/ProveedoresPanel";
import { requirePermiso } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function ProveedoresPage() {
  await requirePermiso("compras");
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--erp-text)", marginBottom: 4 }}>Proveedores</h2>
      <p style={{ fontSize: 13, color: "var(--erp-text-2)", marginBottom: 20 }}>Gestiona tus proveedores y sus condiciones de crédito.</p>
      <ProveedoresPanel />
    </div>
  );
}

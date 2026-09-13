import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import InventarioDashboardClient from "@/components/InventarioDashboardClient";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  await requirePermiso("productos");

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando inventario…</div>}>
      <InventarioDashboardClient />
    </Suspense>
  );
}

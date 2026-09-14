import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import RecetasProduccionClient from "@/components/RecetasProduccionClient";

export const dynamic = "force-dynamic";

export default async function RecetasProduccionPage() {
  await requirePermiso("productos");

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando recetas de producción…</div>}>
      <RecetasProduccionClient />
    </Suspense>
  );
}

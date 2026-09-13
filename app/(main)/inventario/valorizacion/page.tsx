import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import ValorizacionInventarioClient from "@/components/ValorizacionInventarioClient";

export const dynamic = "force-dynamic";

export default async function ValorizacionInventarioPage() {
  await requirePermiso("reportes");

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Calculando valorización…</div>}>
      <ValorizacionInventarioClient />
    </Suspense>
  );
}

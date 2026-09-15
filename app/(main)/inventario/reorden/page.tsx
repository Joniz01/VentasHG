import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import ReordenInventarioClient from "@/components/ReordenInventarioClient";

export const dynamic = "force-dynamic";

export default async function ReordenInventarioPage() {
  await requirePermiso("productos");

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando reglas de reorden…</div>}>
      <ReordenInventarioClient />
    </Suspense>
  );
}

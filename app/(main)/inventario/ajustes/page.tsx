import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import AjustesInventarioClient from "@/components/AjustesInventarioClient";

export const dynamic = "force-dynamic";

export default async function AjustesInventarioPage() {
  await requirePermiso("productos");

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando ajustes…</div>}>
      <AjustesInventarioClient />
    </Suspense>
  );
}

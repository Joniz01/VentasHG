import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import LotesVencimientosClient from "@/components/LotesVencimientosClient";

export const dynamic = "force-dynamic";

export default async function LotesVencimientosPage() {
  await requirePermiso("productos");

  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando lotes…</div>}>
      <LotesVencimientosClient />
    </Suspense>
  );
}

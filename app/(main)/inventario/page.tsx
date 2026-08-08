import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import InventarioDashboardClient from "@/components/InventarioDashboardClient";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  await requirePermiso("productos");

  return (
    <Suspense>
      <InventarioDashboardClient />
    </Suspense>
  );
}

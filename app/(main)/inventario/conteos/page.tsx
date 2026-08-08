import { Suspense } from "react";
import { requirePermiso } from "@/lib/auth";
import BandejaConteoClient from "@/components/BandejaConteoClient";

export const dynamic = "force-dynamic";

export default async function BandejaConteoPage() {
  await requirePermiso("autorizarConteo");

  return (
    <Suspense>
      <BandejaConteoClient />
    </Suspense>
  );
}

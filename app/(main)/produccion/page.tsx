import { requirePermiso } from "@/lib/auth";
import OrdenesProduccionClient from "@/components/OrdenesProduccionClient";

export const dynamic = "force-dynamic";

export default async function OrdenesProduccionPage() {
  await requirePermiso("productos");
  return <OrdenesProduccionClient />;
}

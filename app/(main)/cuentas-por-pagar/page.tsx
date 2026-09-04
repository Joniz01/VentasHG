import { requirePermiso } from "@/lib/auth";
import CuentasPagarClient from "@/components/CuentasPagarClient";

export const dynamic = "force-dynamic";

export default async function CuentasPorPagarPage() {
  await requirePermiso("compras");
  return <CuentasPagarClient />;
}

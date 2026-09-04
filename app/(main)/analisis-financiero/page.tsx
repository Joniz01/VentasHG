import { requirePermiso } from "@/lib/auth";
import AnalisisFinancieroClient from "@/components/AnalisisFinancieroClient";

export const dynamic = "force-dynamic";

export default async function AnalisisFinancieroPage() {
  await requirePermiso("reportes");
  return <AnalisisFinancieroClient />;
}

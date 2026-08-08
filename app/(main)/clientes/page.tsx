import { requirePermiso } from "@/lib/auth";
import ClientesPageClient from "@/components/ClientesPageClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const sesion = await requirePermiso("ventas");
  return <ClientesPageClient rol={sesion.rol} />;
}

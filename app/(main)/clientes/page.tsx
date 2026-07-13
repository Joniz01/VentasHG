import ClientesTab from "@/components/ClientesTab";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const sesion = await requirePermiso("ventas");
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--erp-text)", marginBottom: 4 }}>Clientes</h2>
      <p style={{ fontSize: 13, color: "var(--erp-text-2)", marginBottom: 20 }}>Gestiona tus clientes y su información de contacto.</p>
      <ClientesTab rol={sesion.rol} />
    </div>
  );
}

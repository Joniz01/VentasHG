import RecepcionPanel from "@/components/RecepcionPanel";
import { requirePermiso } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function RecepcionesPage() {
  await requirePermiso("compras");
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--erp-text)", marginBottom: 4 }}>Recepción de Mercancía</h2>
      <p style={{ fontSize: 13, color: "var(--erp-text-2)", marginBottom: 20 }}>Registra mercancía recibida sin factura. Relaciónala con su factura cuando llegue.</p>
      <RecepcionPanel />
    </div>
  );
}

import VentasClient from "@/components/VentasClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VentasPage() {
  const sesion = await requirePermiso("ventas");

  return (
    <VentasClient rol={sesion.rol} puedeDescuento={sesion.rol === "ADMIN" || sesion.permisos.descuento} />
  );
}

import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function AjustesInventarioPage() {
  await requirePermiso("productos");
  return (
    <ProximamentePage
      icon="⚖️"
      titulo="Ajustes de Inventario"
      descripcion="Registra entradas y salidas manuales de stock: mermas, pérdidas, vencimientos, producción interna y donaciones — sin asociar a una venta ni a una orden de compra."
      detalles={[
        "Ajuste positivo: entrada de stock (producción propia, corrección)",
        "Ajuste negativo: merma, pérdida, vencimiento, robo",
        "Motivo obligatorio y trazabilidad completa por usuario",
        "Impacta stock en tiempo real y aparece en Movimientos",
      ]}
    />
  );
}

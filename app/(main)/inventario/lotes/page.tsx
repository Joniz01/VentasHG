import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function LotesVencimientosPage() {
  await requirePermiso("productos");
  return (
    <ProximamentePage
      icon="🏷️"
      titulo="Lotes & Vencimientos"
      descripcion="Trazabilidad completa por lote para insumos y productos perecederos. Controla fechas de vencimiento, aplica salidas FIFO y genera alertas automáticas antes de la caducidad."
      detalles={[
        "Registro de lotes al momento de la recepción de compra",
        "Alertas configurables: N días antes del vencimiento",
        "Método FIFO automático en despacho y producción",
        "Historial de lotes retirados o vencidos",
        "Crítico para cumplimiento sanitario en alimentos",
      ]}
    />
  );
}

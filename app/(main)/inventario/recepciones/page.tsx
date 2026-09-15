import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function RecepcionesPage() {
  await requirePermiso("compras");
  return (
    <ProximamentePage
      icon="📥"
      titulo="Recepciones de Compra"
      descripcion="Registra la entrada física de mercancía al almacén al recibir una Orden de Compra. Actualiza el stock automáticamente y cierra o parcializa la OC correspondiente."
      detalles={[
        "Vinculado a Órdenes de Compra existentes",
        "Recepción total o parcial por ítem",
        "Genera movimiento de entrada en Inventario y Movimientos",
        "Soporte para recepciones en múltiples entregas",
      ]}
    />
  );
}

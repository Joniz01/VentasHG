import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function ReglasReordenPage() {
  await requirePermiso("productos");
  return (
    <ProximamentePage
      icon="🔁"
      titulo="Reglas de Reorden"
      descripcion="Define el stock mínimo y la cantidad de reorden para cada producto e insumo. El MRP las usa para generar Órdenes de Compra automáticas cuando el stock cae por debajo del umbral."
      detalles={[
        "Stock mínimo (punto de reorden) por producto",
        "Cantidad de reorden sugerida",
        "Proveedor preferido por ítem",
        "Tiempo de entrega estimado (lead time)",
        "Alimenta el motor de planificación MRP",
      ]}
    />
  );
}

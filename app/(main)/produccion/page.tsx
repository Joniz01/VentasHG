import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function OrdenesProduccionPage() {
  await requirePermiso("productos");
  return (
    <ProximamentePage
      icon="🏭"
      titulo="Órdenes de Producción"
      descripcion="Gestiona la fabricación interna: crea órdenes para transformar insumos en productos terminados, consume el stock de materias primas y registra la entrada del producto elaborado."
      detalles={[
        "Creación manual o desde sugerencias del MRP",
        "Consume stock de insumos al confirmar producción",
        "Ingresa el producto terminado al inventario",
        "Control de mermas y rendimiento de producción",
        "Estado: Borrador → Confirmada → En producción → Terminada",
      ]}
    />
  );
}

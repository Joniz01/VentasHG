import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function BOMPage() {
  await requirePermiso("productos");
  return (
    <ProximamentePage
      icon="📐"
      titulo="Lista de Materiales (BOM)"
      descripcion="Gestión centralizada de las recetas de producción. Define qué insumos y en qué cantidad se necesitan para elaborar cada producto terminado o semielaborado."
      detalles={[
        "Ingredientes y cantidades por unidad de producción",
        "Soporte para BOMs multinivel (producto dentro de producto)",
        "Costo de producción calculado desde los insumos",
        "Vinculado a Órdenes de Producción y MRP",
        "Versiones de receta con historial de cambios",
      ]}
    />
  );
}

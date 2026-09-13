import { requirePermiso } from "@/lib/auth";
import ProximamentePage from "@/components/ProximamentePage";

export const dynamic = "force-dynamic";

export default async function ValorizacionInventarioPage() {
  await requirePermiso("reportes");
  return (
    <ProximamentePage
      icon="💰"
      titulo="Valorización de Inventario"
      descripcion="Reporte del valor monetario del stock actual calculado por costo promedio ponderado. Muestra el inventario total en Bs y USD, desglosado por categoría y producto."
      detalles={[
        "Costo promedio ponderado por producto",
        "Valor total del inventario en Bs y USD",
        "Desglose por familia / categoría",
        "Comparativa histórica mes a mes",
        "Exportable para contabilidad",
      ]}
    />
  );
}

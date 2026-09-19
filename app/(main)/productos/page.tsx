import ProductosClient from "@/components/ProductosClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  await requirePermiso("productos");

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Productos de Venta</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Catálogo de productos disponibles para la venta en el POS y facturas.
      </p>
      <ProductosClient grupoFiltro="PARA_LA_VENTA" />
    </div>
  );
}

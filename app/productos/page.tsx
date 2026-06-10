import ProductosClient from "@/components/ProductosClient";

export const dynamic = "force-dynamic";

export default function ProductosPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Productos</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Registra los productos del catálogo con su costo y precio de venta.
      </p>
      <ProductosClient />
    </div>
  );
}

import ProductosClient from "@/components/ProductosClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InsumosPage() {
  await requirePermiso("productos");

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Insumos / Materia Prima</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Insumos y materias primas utilizadas en la producción y fabricación.
      </p>
      <ProductosClient grupoFiltro="MATERIA_PRIMA" />
    </div>
  );
}

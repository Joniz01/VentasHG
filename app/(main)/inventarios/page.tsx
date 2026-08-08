import { requirePermiso } from "@/lib/auth";
import InventariosClient from "@/components/InventariosClient";

export const dynamic = "force-dynamic";

export default async function InventariosPage() {
  await requirePermiso("productos");

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Inventarios</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Consulta el stock actual y registra entradas o ajustes de inventario.
      </p>
      <InventariosClient />
    </div>
  );
}

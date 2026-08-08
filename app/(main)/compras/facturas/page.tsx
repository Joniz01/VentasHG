import { requirePermiso } from "@/lib/auth";
import FacturasCompraList from "@/components/FacturasCompraList";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FacturasPage() {
  const sesion = await requirePermiso("compras");

  let tasaBcv = 0;
  try {
    const r = await pool.query("SELECT valor FROM configuracion WHERE clave = 'tasa_bcv' LIMIT 1");
    tasaBcv = r.rows[0] ? Number(r.rows[0].valor) : 0;
  } catch {}

  return (
    <div>
      <FacturasCompraList
        puedeCrearProducto={sesion.rol === "ADMIN" || sesion.permisos.productos}
        tasaBcv={tasaBcv}
        isAdmin={sesion.rol === "ADMIN"}
        puedeEliminarCompras={sesion.rol === "ADMIN" || sesion.permisos.eliminarCompras}
      />
    </div>
  );
}

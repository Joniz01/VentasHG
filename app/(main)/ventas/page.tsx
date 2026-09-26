import Link from "next/link";
import VentasClient from "@/components/VentasClient";
import { requirePermiso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const sesion = await requirePermiso("ventas");
  const { vista } = await searchParams;
  const ocultarCajaRapida = ["cortesias", "promociones", "notas"].includes(vista ?? "");

  return (
    <div>
      {!ocultarCajaRapida && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
          <Link
            href="/caja"
            target="_blank"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.35rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--erp-border)",
              background: "var(--erp-surface)",
              color: "var(--erp-text-2)",
              fontSize: "0.8rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            🧾 Caja Rápida
          </Link>
        </div>
      )}
      <VentasClient
        rol={sesion.rol}
        puedeDescuento={sesion.rol === "ADMIN" || sesion.permisos.descuento}
        puedePromociones={sesion.rol === "ADMIN" || sesion.permisos.promociones}
      />
    </div>
  );
}

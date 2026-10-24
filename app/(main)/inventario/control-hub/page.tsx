import { requirePermiso } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

const cards = [
  { href: "/inventario/ajustes", icon: "⚖️",  label: "Ajustes de Inventario", sub: "Mermas, pérdidas y correcciones",  color: "#B45309" },
  { href: "/inventario/lotes",   icon: "🏷️", label: "Lotes & Vencimientos",   sub: "Trazabilidad y control FIFO",      color: "#0891B2" },
  { href: "/inventario/reorden", icon: "🔁", label: "Reglas de Reorden",       sub: "Puntos de reorden para MRP",       color: "#7C3AED" },
];

export default async function ControlHubPage() {
  await requirePermiso("productos");
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--erp-text)", marginBottom: 6 }}>🔧 Control de Inventario</h1>
      <p style={{ fontSize: 13, color: "var(--erp-text-3)", marginBottom: 24 }}>Ajustes, trazabilidad y reglas de reabastecimiento</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {cards.map((c) => (
          <Link key={c.href} href={c.href}
            style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--erp-surface)", border: `2px solid ${c.color}`, borderRadius: 12, padding: "16px 14px", textDecoration: "none", transition: "opacity .15s" }}
          >
            <span style={{ fontSize: 28 }}>{c.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)", lineHeight: 1.2 }}>{c.label}</span>
            <span style={{ fontSize: 11, color: "var(--erp-text-3)", lineHeight: 1.3 }}>{c.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

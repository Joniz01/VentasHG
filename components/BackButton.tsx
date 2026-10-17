"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Rutas que tienen un destino de vuelta fijo en lugar de history.back()
const BACK_MAP: { pattern: RegExp; href: string }[] = [
  { pattern: /^\/ventas\/\d+/, href: "/reportes" },
];

// Botones extra que aparecen a la derecha del BackButton según la ruta
const RIGHT_EXTRAS: { pattern: RegExp; label: string; href: string }[] = [
  { pattern: /^\/ventas(\?.*)?$/, label: "🧾 Caja Rápida", href: "/caja" },
];

export default function BackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  if (pathname === "/" || pathname === "/admin") return null;

  const fixed = BACK_MAP.find((m) => m.pattern.test(pathname));
  const extra = RIGHT_EXTRAS.find((e) => e.pattern.test(pathname));

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.3rem",
    padding: "0.3rem 0.75rem",
    background: "transparent",
    border: "1px solid var(--erp-border)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.8rem",
    color: "var(--erp-text-2)",
    textDecoration: "none",
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
      <button type="button" onClick={() => (fixed ? router.push(fixed.href) : router.back())} style={btnStyle}>
        ← Atrás
      </button>
      {extra && (
        <Link href={extra.href} target="_blank" style={btnStyle}>
          {extra.label}
        </Link>
      )}
    </div>
  );
}

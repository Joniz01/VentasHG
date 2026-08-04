"use client";

import { usePathname, useRouter } from "next/navigation";

// Rutas que tienen un destino de vuelta fijo en lugar de history.back()
const BACK_MAP: { pattern: RegExp; href: string }[] = [
  { pattern: /^\/ventas\/\d+/, href: "/reportes" },
];

export default function BackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  if (pathname === "/" || pathname === "/admin") return null;

  const fixed = BACK_MAP.find((m) => m.pattern.test(pathname));

  return (
    <button
      type="button"
      onClick={() => (fixed ? router.push(fixed.href) : router.back())}
      style={{
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
        marginBottom: "0.75rem",
      }}
    >
      ← Atrás
    </button>
  );
}

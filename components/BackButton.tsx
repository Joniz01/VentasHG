"use client";

import { usePathname, useRouter } from "next/navigation";

export default function BackButton() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  if (pathname === "/" || pathname === "/admin") return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
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

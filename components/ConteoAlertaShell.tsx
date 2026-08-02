"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ConteoAlertaShell() {
  const [count, setCount] = useState(0);
  const loaded = useRef(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/conteo/pendientes");
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // silencioso
      } finally {
        loaded.current = true;
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <button
      onClick={() => router.push("/inventario/conteos")}
      className="relative flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors"
      style={{ color: "#f59e0b", cursor: "pointer" }}
      title={`${count} conteo${count !== 1 ? "s" : ""} de inventario pendiente${count !== 1 ? "s" : ""} de revisión`}
    >
      <span>📋</span>
      <span
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          minWidth: 14,
          height: 14,
          borderRadius: "50%",
          background: "#f59e0b",
          color: "#fff",
          fontSize: "9px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          padding: "0 2px",
          border: "1.5px solid var(--erp-shell)",
        }}
      >
        {count > 99 ? "99+" : count}
      </span>
    </button>
  );
}

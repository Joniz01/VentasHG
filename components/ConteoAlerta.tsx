"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function ConteoAlerta() {
  const [count, setCount] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/conteo/pendientes");
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // ignorar
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
    <Link
      href="/inventario/conteos"
      title="Conteos de inventario pendientes de revisión"
      className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-1.5 text-xs font-bold text-white hover:opacity-80"
      style={{ background: "#f59e0b" }}
    >
      <span>📋</span>
      <span>{count}</span>
    </Link>
  );
}

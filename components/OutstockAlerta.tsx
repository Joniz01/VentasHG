"use client";

import { useEffect, useState } from "react";

const POLL_MS = 5 * 60 * 1000;

export default function OutstockAlerta({ collapsed }: { collapsed: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/inventario/outstock-count");
        if (!res.ok) return;
        const data = await res.json() as { count: number };
        setCount(data.count);
      } catch { /* silencioso */ }
    };
    check();
    const interval = setInterval(check, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!count) return null;

  if (collapsed) {
    return (
      <span
        style={{
          position: "absolute", top: 4, right: 4,
          width: 7, height: 7, borderRadius: "50%",
          background: "#f97316",
        }}
      />
    );
  }

  return (
    <span
      title={`${count} producto${count !== 1 ? "s" : ""} con stock bajo`}
      style={{
        marginLeft: "auto",
        minWidth: 16, height: 16, borderRadius: 8,
        background: "#f97316", color: "#fff",
        fontSize: 9, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 4px",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

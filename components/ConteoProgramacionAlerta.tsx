"use client";

import { useEffect, useState } from "react";

export default function ConteoProgramacionAlerta() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/conteo-programacion/hoy");
        if (!res.ok) return;
        const data = await res.json();
        setCount(data.count ?? 0);
      } catch { /* ignore */ }
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span
      className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none"
      style={{ background: "#FEF3C7", color: "#92400E" }}
    >
      {count}
    </span>
  );
}

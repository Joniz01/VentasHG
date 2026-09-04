"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DISMISSED_KEY = "conteo_prog_alerta_dismissed_day";

function isDismissedToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISSED_KEY) === new Date().toISOString().slice(0, 10);
}

export default function ConteoProgramacionAlertaShell() {
  const [count, setCount] = useState(0);
  const [ringing, setRinging] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ringingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);
  const router = useRouter();

  useEffect(() => {
    setDismissed(isDismissedToday());
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/conteo-programacion/hoy");
        if (!res.ok) return;
        const data = await res.json();
        const n = data.count ?? 0;
        const wasDismissed = isDismissedToday();
        if (n > 0 && !wasDismissed && (loaded.current === false || n > count)) {
          setRinging(true);
          if (ringingTimer.current) clearTimeout(ringingTimer.current);
          ringingTimer.current = setTimeout(() => setRinging(false), 2000);
        }
        setCount(n);
      } catch { /* silencioso */ } finally {
        loaded.current = true;
      }
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (ringingTimer.current) clearTimeout(ringingTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (count === 0 || dismissed) return null;

  function handleClick() {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString().slice(0, 10));
    setDismissed(true);
    setRinging(false);
    router.push("/inventario/programacion");
  }

  return (
    <>
      <style>{`
        @keyframes prog-ring {
          0%   { transform: rotate(0deg); }
          10%  { transform: rotate(-18deg); }
          20%  { transform: rotate(18deg); }
          30%  { transform: rotate(-14deg); }
          40%  { transform: rotate(14deg); }
          50%  { transform: rotate(-8deg); }
          60%  { transform: rotate(8deg); }
          70%  { transform: rotate(-4deg); }
          80%  { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
        .prog-ring { animation: prog-ring 0.6s ease-in-out; transform-origin: top center; }
      `}</style>
      <button
        onClick={handleClick}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors"
        style={{ color: "#f59e0b", cursor: "pointer" }}
        title={`${count} conteo${count !== 1 ? "s" : ""} programado${count !== 1 ? "s" : ""} para hoy`}
      >
        <span className={ringing ? "prog-ring" : ""} style={{ display: "inline-block" }}>
          🗓️
        </span>
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
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AlarmasConfig, CuentaPorCobrarItem } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT } from "@/lib/types";
import { alarmaVencimientoActiva } from "@/lib/cuentasPorCobrar";

export default function CuentasPorCobrarAlerta() {
  const [items, setItems] = useState<CuentaPorCobrarItem[]>([]);
  const [vencimientoHora, setVencimientoHora] = useState(ALARMAS_CONFIG_DEFAULT.vencimientoHora);
  const [now, setNow] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const [itemsRes, configRes] = await Promise.all([
          fetch("/api/reportes/cuentas-por-cobrar?cobrada=PENDIENTE"),
          fetch("/api/alarmas-config"),
        ]);
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setItems(data.items as CuentaPorCobrarItem[]);
        }
        if (configRes.ok) {
          const config = (await configRes.json()) as AlarmasConfig;
          setVencimientoHora(config.vencimientoHora);
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!now) return null;

  const count = items.filter((item) => alarmaVencimientoActiva(item, now, vencimientoHora)).length;

  if (count === 0) return null;

  return (
    <Link
      href="/reportes?tab=cuentasPorCobrar"
      title="Cuentas por cobrar con plazo vencido"
      className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white hover:bg-red-700"
    >
      {count}
    </Link>
  );
}

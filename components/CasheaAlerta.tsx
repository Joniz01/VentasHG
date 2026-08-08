"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AlarmasConfig, CasheaPagoItem } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT } from "@/lib/types";

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function esVencida(item: CasheaPagoItem, now: number): boolean {
  if (item.liquidado) return false;
  return item.fechaVencimiento <= toIsoDate(new Date(now));
}

function alarmaActiva(item: CasheaPagoItem, now: number, hora: string): boolean {
  if (!esVencida(item, now)) return false;
  if (item.alarmaSilenciadaHasta && now < new Date(item.alarmaSilenciadaHasta).getTime()) return false;
  const [hh, mm] = hora.split(":").map(Number);
  const horaHoy = new Date(now);
  horaHoy.setHours(hh, mm, 0, 0);
  return now >= horaHoy.getTime();
}

export default function CasheaAlerta() {
  const [items, setItems] = useState<CasheaPagoItem[]>([]);
  const [hora, setHora] = useState(ALARMAS_CONFIG_DEFAULT.casheaVencimientoHora);
  const [now, setNow] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const [itemsRes, configRes] = await Promise.all([
          fetch("/api/reportes/cashea?estado=PENDIENTE"),
          fetch("/api/alarmas-config"),
        ]);
        if (itemsRes.ok) {
          const data = await itemsRes.json();
          setItems(data.items as CasheaPagoItem[]);
        }
        if (configRes.ok) {
          const config = (await configRes.json()) as AlarmasConfig;
          setHora(config.casheaVencimientoHora ?? ALARMAS_CONFIG_DEFAULT.casheaVencimientoHora);
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

  const count = items.filter((item) => alarmaActiva(item, now, hora)).length;
  if (count === 0) return null;

  return (
    <Link
      href="/reportes?tab=cashea"
      title="Pagos Cashea vencidos pendientes de liquidación"
      className="flex h-7 min-w-7 items-center justify-center gap-1 rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-black hover:bg-yellow-300"
    >
      <span>C</span>
      <span>{count}</span>
    </Link>
  );
}

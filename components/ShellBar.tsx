"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import PerfilMenu from "@/components/PerfilMenu";

const MODULE_NAMES: Record<string, string> = {
  "/ventas":             "Punto de Venta",
  "/pedidos-pendientes": "Pedidos Pendientes",
  "/productos":          "Inventario · Productos",
  "/inventarios":        "Inventario · Stock",
  "/compras":            "Compras",
  "/mrp":                "MRP · Planificación",
  "/nomina":             "Nómina & Gastos",
  "/reportes":           "Reportes",
  "/delivery":           "Delivery",
  "/dashboard":          "Dashboard",
  "/admin":              "Administración",
};

const THEMES = [
  { id: "",        label: "Corporate",              dark: false, swatch: ["#0F1B2D", "#1D4ED8"] },
  { id: "ng",      label: "Naranja & Verde",        dark: false, swatch: ["#12291A", "#16A34A"] },
  { id: "hg",      label: "Hechizo Gourmet",        dark: false, swatch: ["#1A1A1A", "#C81515"] },
  { id: "dark",    label: "Corporate Oscuro",       dark: true,  swatch: ["#050D1A", "#3B82F6"] },
  { id: "ng-dark", label: "Naranja & Verde Oscuro", dark: true,  swatch: ["#0A1A0F", "#22C55E"] },
  { id: "hg-dark", label: "Hechizo Oscuro",         dark: true,  swatch: ["#0F0F0F", "#E03030"] },
];

type Props = { sesionActiva: boolean; empresa: string };

export default function ShellBar({ sesionActiva, empresa }: Props) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const moduleName =
    Object.entries(MODULE_NAMES).find(([k]) => pathname?.startsWith(k))?.[1] ??
    "Inicio";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const light = THEMES.filter((t) => !t.dark);
  const dark  = THEMES.filter((t) => t.dark);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center gap-3 px-4 shadow-md"
      style={{ background: "var(--erp-shell)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Image
          src="/logo.jpg"
          alt={empresa}
          width={32}
          height={40}
          className="h-8 w-auto rounded"
          priority
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-white">{empresa}</span>
          <span className="text-[10px]" style={{ color: "var(--erp-shell-text)" }}>
            VentasHG ERP
          </span>
        </div>
      </div>

      <div
        className="h-5 w-px shrink-0 mx-1"
        style={{ background: "rgba(255,255,255,.15)" }}
      />

      {/* Module name */}
      <span
        className="text-xs hidden sm:block"
        style={{ color: "var(--erp-shell-text)" }}
      >
        {moduleName}
      </span>

      <div className="flex-1" />

      {/* Theme picker */}
      <div ref={pickerRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            borderColor: "rgba(255,255,255,.18)",
            color: "var(--erp-shell-text)",
            background: "rgba(255,255,255,.06)",
          }}
        >
          🎨 Tema ▾
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-1.5 w-52 rounded-lg overflow-hidden shadow-xl z-[200]"
            style={{
              background: "var(--erp-surface)",
              border: "1px solid var(--erp-border)",
            }}
          >
            <ThemeSection label="Claro" themes={light} current={theme} onSelect={(id) => { setTheme(id); setOpen(false); }} />
            <ThemeSection label="Oscuro" themes={dark} current={theme} onSelect={(id) => { setTheme(id); setOpen(false); }} />
          </div>
        )}
      </div>

      {/* Bell */}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors"
        style={{ color: "var(--erp-shell-text)" }}
        title="Notificaciones"
      >
        🔔
      </button>

      {/* Profile */}
      {sesionActiva && <PerfilMenu />}
    </header>
  );
}

function ThemeSection({
  label, themes, current, onSelect,
}: {
  label: string;
  themes: typeof THEMES;
  current: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div
        className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--erp-text-3)" }}
      >
        {label}
      </div>
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left"
          style={{
            background: current === t.id ? "var(--erp-primary-lt)" : undefined,
            color: current === t.id ? "var(--erp-primary)" : "var(--erp-text)",
            fontWeight: current === t.id ? 600 : 400,
          }}
        >
          <span
            className="h-4 w-4 rounded shrink-0"
            style={{
              background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
            }}
          />
          {t.label}
          {current === t.id && <span className="ml-auto">✓</span>}
        </button>
      ))}
    </>
  );
}

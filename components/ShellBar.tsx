"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  "/delivery":           "Deliveries",
  "/dashboard":          "Dashboard",
  "/clientes":            "Clientes",
  "/crm":                 "CRM",
  "/cuentas-por-pagar":   "Cuentas por Pagar",
  "/analisis-financiero": "Análisis Financiero",
  "/ia-analisis":         "IA Análisis",
  "/admin":              "Configuración",
};

const THEMES = [
  { id: "",        label: "Corporate",              dark: false, swatch: ["#0F1B2D", "#1D4ED8"] },
  { id: "ng",      label: "Naranja & Verde",        dark: false, swatch: ["#12291A", "#16A34A"] },
  { id: "hg",      label: "Hechizo Gourmet",        dark: false, swatch: ["#1A1A1A", "#C81515"] },
  { id: "dark",    label: "Corporate Oscuro",       dark: true,  swatch: ["#050D1A", "#3B82F6"] },
  { id: "ng-dark", label: "Naranja & Verde Oscuro", dark: true,  swatch: ["#0A1A0F", "#22C55E"] },
  { id: "hg-dark", label: "Hechizo Oscuro",         dark: true,  swatch: ["#0F0F0F", "#E03030"] },
];

const CXC_POLL_MS = 5 * 60 * 1000; // 5 minutos

type Props = { sesionActiva: boolean; empresa: string };

export default function ShellBar({ sesionActiva, empresa }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // CxC vencidas
  const [cxcVencidas, setCxcVencidas] = useState(0);
  const [cxcRinging, setCxcRinging] = useState(false);
  const [cxcDismissed, setCxcDismissed] = useState(false);
  const ringingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkCxc = useCallback(async () => {
    if (!sesionActiva) return;
    try {
      const res = await fetch("/api/cuentas-por-cobrar/alertas");
      if (!res.ok) return;
      const data = await res.json() as { vencidas: number };
      setCxcVencidas(data.vencidas);
      if (data.vencidas > 0 && !cxcDismissed) {
        setCxcRinging(true);
        if (ringingTimer.current) clearTimeout(ringingTimer.current);
        ringingTimer.current = setTimeout(() => setCxcRinging(false), 2000);
      }
    } catch { /* silencioso */ }
  }, [sesionActiva, cxcDismissed]);

  useEffect(() => {
    checkCxc();
    const interval = setInterval(checkCxc, CXC_POLL_MS);
    return () => { clearInterval(interval); if (ringingTimer.current) clearTimeout(ringingTimer.current); };
  }, [checkCxc]);

  // Resetear dismissed cuando sale de la sección
  useEffect(() => {
    if (!pathname?.startsWith("/cuentas-por-cobrar")) {
      setCxcDismissed(false);
    }
  }, [pathname]);

  function handleCxcBell() {
    setCxcDismissed(true);
    setCxcRinging(false);
    router.push("/cuentas-por-cobrar?filtro=vencidas");
  }

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
      {/* Hamburger — mobile only */}
      <button
        className="md:hidden flex h-8 w-8 items-center justify-center rounded text-lg shrink-0"
        style={{ color: "var(--erp-shell-text)" }}
        onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {/* Logo — links to home */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity">
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
      </Link>

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

      {/* Bell — CxC vencidas */}
      {sesionActiva && (
        <>
          <style>{`
            @keyframes cxc-ring {
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
            .cxc-ring { animation: cxc-ring 0.6s ease-in-out; transform-origin: top center; }
          `}</style>
          <button
            onClick={cxcVencidas > 0 ? handleCxcBell : undefined}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors"
            style={{
              color: cxcVencidas > 0 ? "#ef4444" : "var(--erp-shell-text)",
              cursor: cxcVencidas > 0 ? "pointer" : "default",
            }}
            title={cxcVencidas > 0 ? `${cxcVencidas} cuenta${cxcVencidas !== 1 ? "s" : ""} por cobrar vencida${cxcVencidas !== 1 ? "s" : ""}` : "Sin cuentas vencidas"}
          >
            <span className={cxcRinging ? "cxc-ring" : ""} style={{ display: "inline-block" }}>
              💰
            </span>
            {cxcVencidas > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  minWidth: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#ef4444",
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
                {cxcVencidas > 99 ? "99+" : cxcVencidas}
              </span>
            )}
          </button>
        </>
      )}

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

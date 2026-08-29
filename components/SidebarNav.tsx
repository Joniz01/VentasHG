"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { PermisosUsuario, Rol } from "@/lib/types";
import CuentasPorCobrarAlerta from "@/components/CuentasPorCobrarAlerta";
import CasheaAlerta from "@/components/CasheaAlerta";
import ConteoAlerta from "@/components/ConteoAlerta";

type Props = { rol: Rol | null; permisos: PermisosUsuario | null };

type NavItem = {
  href: string;
  label: string;
  icon: string;
  permiso?: keyof PermisosUsuario;
  rolReq?: Rol;
  badge?: "cxc" | "cashea" | "conteo";
};

type NavGroup = { label: string; items: NavItem[] };

const GRUPOS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/", icon: "🏠", label: "Inicio" },
    ],
  },
  {
    label: "Ventas",
    items: [
      { href: "/ventas",                   icon: "🛒", label: "Punto de Venta",    permiso: "ventas" },
      { href: "/pedidos-pendientes",       icon: "📋", label: "Pedidos Pendientes", permiso: "pedidosPendientes" },
      { href: "/delivery",                 icon: "📬", label: "Deliveries" },
      { href: "/ventas?vista=cortesias",   icon: "🎁", label: "Salida Cortesías",   permiso: "ventas" },
      { href: "/ventas?vista=promociones", icon: "🏷️", label: "Promociones",        permiso: "ventas" },
      { href: "/ventas?vista=notas",       icon: "📝", label: "Notas de Entrega",   permiso: "ventas" },
    ],
  },
  {
    label: "Reportes & KPI",
    items: [
      { href: "/dashboard",   icon: "📈", label: "Dashboard",    permiso: "dashboard" },
      { href: "/reportes",    icon: "📑", label: "Reportes",     permiso: "reportes" },
      { href: "/ia-analisis", icon: "🤖", label: "IA Análisis" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/clientes", icon: "👤", label: "Clientes", permiso: "ventas" },
      { href: "/crm",      icon: "🤝", label: "CRM" },
    ],
  },
  {
    label: "Inventario",
    items: [
      { href: "/productos",          icon: "📦", label: "Productos",                permiso: "productos" },
      { href: "/inventario",         icon: "🚦", label: "Dashboard Stock",          permiso: "productos" },
      { href: "/inventarios",        icon: "📊", label: "Inventario y Movimientos", permiso: "productos" },
      { href: "/inventario/conteos", icon: "📋", label: "Bandeja Conteos",          permiso: "autorizarConteo", badge: "conteo" },
      { href: "/conteo",             icon: "📱", label: "Conteo Físico",            permiso: "conteo" },
    ],
  },
  {
    label: "Compras & Producción",
    items: [
      { href: "/compras", icon: "🛍️", label: "Órdenes de Compra",   permiso: "compras" },
      { href: "/mrp",     icon: "⚙️",  label: "MRP · Planificación" },
    ],
  },
  {
    label: "Nómina & Gastos",
    items: [
      { href: "/nomina", icon: "👷", label: "Nómina", permiso: "gastos" },
      { href: "/gastos", icon: "💸", label: "Gastos", permiso: "gastos" },
    ],
  },
  {
    label: "Tesorería",
    items: [
      { href: "/tesoreria",         icon: "🏦", label: "Planif. de Pagos",  permiso: "gastos" },
      { href: "/cuentas-por-pagar", icon: "📤", label: "Cuentas por Pagar" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/cuentas-por-cobrar",  icon: "💳", label: "Cuentas por Cobrar",  permiso: "reportes", badge: "cxc" },
      { href: "/analisis-financiero", icon: "📊", label: "Análisis Financiero" },
    ],
  },
  {
    label: "Admin & Configuración",
    items: [
      { href: "/admin", icon: "🔧", label: "Configuración", rolReq: "ADMIN" },
    ],
  },
];

function labelToSlug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isVisible(item: NavItem, rol: Rol | null, permisos: PermisosUsuario | null): boolean {
  if (item.rolReq) return rol === item.rolReq;
  if (!item.permiso) return true;
  if (rol === "ADMIN") return true;
  return !!permisos?.[item.permiso];
}

function GroupLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const slug = labelToSlug(label);

  const handleClick = useCallback(() => {
    if (pathname === "/") {
      const el = document.getElementById(`section-${slug}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/?section=${slug}`);
    }
  }, [pathname, router, slug]);

  if (collapsed) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-70"
      style={{ color: "var(--erp-text-3)", background: "transparent", border: "none", cursor: "pointer" }}
    >
      {label}
    </button>
  );
}

export default function SidebarNav({ rol, permisos }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const puedeVerReportes = rol === "ADMIN" || !!permisos?.reportes;

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved === "true") {
        setCollapsed(true);
        document.documentElement.style.setProperty("--sidebar-w", "56px");
      }
    } catch { /* ignore */ }
  }, []);

  // Sync CSS var and localStorage when collapsed changes
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "56px" : "220px");
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  // Listen for toggle events from ShellBar hamburger
  useEffect(() => {
    const handler = () => setOpen((o) => !o);
    window.addEventListener("toggle-sidebar", handler);
    return () => window.removeEventListener("toggle-sidebar", handler);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const navContent = (collapsed: boolean) => (
    <>
      {/* Collapse toggle button */}
      <div className="hidden md:flex justify-end px-2 pt-2 pb-1 shrink-0">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className="flex items-center justify-center rounded-md border text-[11px] font-bold transition-colors hover:bg-opacity-80"
          style={{
            width: 24, height: 24,
            borderColor: "var(--erp-border)",
            color: "var(--erp-text-3)",
            background: "var(--erp-surface)",
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {GRUPOS.map((grupo) => {
          const visibles = grupo.items.filter((item) => isVisible(item, rol, permisos));
          if (!visibles.length) return null;
          return (
            <div key={grupo.label} className="mb-1">
              <GroupLabel label={grupo.label} collapsed={collapsed} />
              {visibles.map((item) => {
                const [itemPath, itemQuery] = item.href.split("?");
                const itemParams = itemQuery ? new URLSearchParams(itemQuery) : null;
                const active = itemParams
                  ? pathname === itemPath && [...itemParams.entries()].every(([k, v]) => searchParams.get(k) === v)
                  : pathname?.startsWith(item.href) && !item.href.includes("?");
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className="flex items-center gap-2.5 py-[7px] text-[12.5px] transition-colors"
                    style={{
                      paddingLeft: collapsed ? 0 : 12,
                      paddingRight: collapsed ? 0 : 12,
                      justifyContent: collapsed ? "center" : undefined,
                      borderLeft: !collapsed && active
                        ? "3px solid var(--erp-primary)"
                        : !collapsed ? "3px solid transparent" : undefined,
                      background: active ? "var(--erp-primary-lt)" : undefined,
                      color: active ? "var(--erp-primary)" : "var(--erp-text-2)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span className="shrink-0 text-center text-[15px]" style={{ width: collapsed ? "100%" : 16 }}>{item.icon}</span>
                    {!collapsed && <span className="flex-1 leading-tight">{item.label}</span>}
                    {!collapsed && item.badge === "cxc" && puedeVerReportes && <CuentasPorCobrarAlerta />}
                    {!collapsed && item.badge === "cashea" && puedeVerReportes && <CasheaAlerta />}
                    {!collapsed && item.badge === "conteo" && <ConteoAlerta />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <div
          className="shrink-0 border-t px-3 py-2.5 text-[10px]"
          style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-3)" }}
        >
          VentasHG v3.0 · © 2026 HG
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ── Desktop: always visible sidebar ── */}
      <aside
        className="hidden md:flex fixed top-12 bottom-0 left-0 z-40 flex-col border-r overflow-hidden"
        style={{
          width: collapsed ? 56 : 220,
          transition: "width 0.2s ease",
          background: "var(--erp-surface)",
          borderColor: "var(--erp-border)",
        }}
      >
        {navContent(collapsed)}
      </aside>

      {/* ── Mobile: overlay drawer ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className="md:hidden fixed top-12 bottom-0 left-0 z-50 flex w-[220px] flex-col border-r transition-transform duration-250"
        style={{
          background: "var(--erp-surface)",
          borderColor: "var(--erp-border)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {navContent(false)}
      </aside>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { PermisosUsuario, Rol } from "@/lib/types";
import CuentasPorCobrarAlerta from "@/components/CuentasPorCobrarAlerta";
import CasheaAlerta from "@/components/CasheaAlerta";

type Props = { rol: Rol | null; permisos: PermisosUsuario | null };

type NavItem = {
  href: string;
  label: string;
  icon: string;
  permiso?: keyof PermisosUsuario;
  rolReq?: Rol;
  badge?: "cxc" | "cashea";
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
    label: "Punto de Venta",
    items: [
      { href: "/ventas",             icon: "🛒", label: "Registrar Venta",    permiso: "ventas" },
      { href: "/pedidos-pendientes", icon: "📋", label: "Pedidos Pendientes", permiso: "pedidosPendientes" },
    ],
  },
  {
    label: "Inventario",
    items: [
      { href: "/productos",   icon: "📦", label: "Productos",      permiso: "productos" },
      { href: "/inventarios", icon: "📊", label: "Stock & Costos", permiso: "productos" },
    ],
  },
  {
    label: "Compras",
    items: [
      { href: "/compras", icon: "🛍️", label: "Compras", permiso: "compras" },
    ],
  },
  {
    label: "Producción",
    items: [
      { href: "/mrp", icon: "⚙️", label: "MRP · Planificación" },
    ],
  },
  {
    label: "Nómina & Gastos",
    items: [
      { href: "/nomina", icon: "👷", label: "Nómina & Gastos" },
    ],
  },
  {
    label: "Cuentas por Cobrar",
    items: [
      { href: "/cuentas-por-cobrar", icon: "💳", label: "Cuentas por Cobrar", permiso: "reportes", badge: "cxc" },
      { href: "/delivery",           icon: "📬", label: "Deliveries" },
    ],
  },
  {
    label: "Reportes",
    items: [
      { href: "/dashboard", icon: "📈", label: "Dashboard", permiso: "dashboard" },
      { href: "/reportes",  icon: "📑", label: "Reportes",  permiso: "reportes" },
    ],
  },
  {
    label: "Administración",
    items: [
      { href: "/admin", icon: "⚙️", label: "Admin", rolReq: "ADMIN" },
    ],
  },
];

function isVisible(item: NavItem, rol: Rol | null, permisos: PermisosUsuario | null): boolean {
  if (item.rolReq) return rol === item.rolReq;
  if (!item.permiso) return true;
  if (rol === "ADMIN") return true;
  return !!permisos?.[item.permiso];
}

export default function SidebarNav({ rol, permisos }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const puedeVerReportes = rol === "ADMIN" || !!permisos?.reportes;

  // Listen for toggle events dispatched by ShellBar hamburger
  useEffect(() => {
    const handler = () => setOpen((o) => !o);
    window.addEventListener("toggle-sidebar", handler);
    return () => window.removeEventListener("toggle-sidebar", handler);
  }, []);

  // Close on route change (mobile navigation)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const navContent = (
    <>
      <div className="flex-1 overflow-y-auto py-2">
        {GRUPOS.map((grupo) => {
          const visibles = grupo.items.filter((item) => isVisible(item, rol, permisos));
          if (!visibles.length) return null;
          return (
            <div key={grupo.label} className="mb-1">
              <div
                className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--erp-text-3)" }}
              >
                {grupo.label}
              </div>
              {visibles.map((item) => {
                const active = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className="flex items-center gap-2.5 px-3 py-[7px] text-[12.5px] transition-colors"
                    style={{
                      borderLeft: active
                        ? "3px solid var(--erp-primary)"
                        : "3px solid transparent",
                      background: active ? "var(--erp-primary-lt)" : undefined,
                      color: active ? "var(--erp-primary)" : "var(--erp-text-2)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span className="w-4 shrink-0 text-center text-[13px]">{item.icon}</span>
                    <span className="flex-1 leading-tight">{item.label}</span>
                    {item.badge === "cxc" && puedeVerReportes && <CuentasPorCobrarAlerta />}
                    {item.badge === "cashea" && puedeVerReportes && <CasheaAlerta />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <div
        className="shrink-0 border-t px-3 py-2.5 text-[10px]"
        style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-3)" }}
      >
        VentasHG v3.0 · © 2026 HG
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop: always visible sidebar ── */}
      <aside
        className="hidden md:flex fixed top-12 bottom-0 left-0 z-40 w-[220px] flex-col border-r"
        style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
      >
        {navContent}
      </aside>

      {/* ── Mobile: overlay drawer ── */}
      {/* Overlay backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className="md:hidden fixed top-12 bottom-0 left-0 z-50 flex w-[220px] flex-col border-r transition-transform duration-250"
        style={{
          background: "var(--erp-surface)",
          borderColor: "var(--erp-border)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {navContent}
      </aside>
    </>
  );
}

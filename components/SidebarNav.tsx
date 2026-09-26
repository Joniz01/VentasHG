"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { PermisosUsuario, Rol } from "@/lib/types";
import CuentasPorCobrarAlerta from "@/components/CuentasPorCobrarAlerta";
import CasheaAlerta from "@/components/CasheaAlerta";
import ConteoAlerta from "@/components/ConteoAlerta";
import ConteoProgramacionAlerta from "@/components/ConteoProgramacionAlerta";
import OutstockAlerta from "@/components/OutstockAlerta";

type Props = { rol: Rol | null; permisos: PermisosUsuario | null };

type NavItem = {
  href: string;
  label: string;
  icon: string;
  permiso?: keyof PermisosUsuario;
  rolReq?: Rol;
  badge?: "cxc" | "cashea" | "conteo" | "programacion";
};

type NavGroup = { label: string; icon?: string; items: NavItem[]; groupBadge?: "outstock"; noCollapse?: boolean };

const GRUPOS: NavGroup[] = [
  {
    label: "Principal",
    noCollapse: true,
    items: [
      { href: "/",     icon: "🏠", label: "Inicio" },
      { href: "/caja", icon: "⚡", label: "Caja Rápida" },
    ],
  },
  {
    label: "Ventas",
    icon: "🛒",
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
    label: "Inventario",
    icon: "📦",
    groupBadge: "outstock",
    items: [
      { href: "/productos",               icon: "🛒", label: "Productos de Venta",      permiso: "productos" },
      { href: "/insumos",                 icon: "🧱", label: "Insumos / Materia Prima",  permiso: "productos" },
      { href: "/inventario",              icon: "🚦", label: "Dashboard Stock",          permiso: "productos" },
      { href: "/inventario/ajustes",      icon: "⚖️",  label: "Ajustes de Inventario",   permiso: "productos" },
      { href: "/inventario-disponible",   icon: "✅", label: "Inventario Disponible",    permiso: "productos" },
      { href: "/inventario/lotes",        icon: "🏷️", label: "Lotes & Vencimientos",     permiso: "productos" },
      { href: "/inventarios",             icon: "📊", label: "Inventario y Movimientos", permiso: "productos" },
      { href: "/inventario/valorizacion", icon: "💰", label: "Valorización",             permiso: "reportes" },
      { href: "/inventario/reorden",      icon: "🔁", label: "Reglas de Reorden",        permiso: "productos" },
      { href: "/inventario/conteos",      icon: "📋", label: "Bandeja Conteos",          permiso: "autorizarConteo", badge: "conteo" },
      { href: "/conteo",                  icon: "📱", label: "Conteo Físico",            permiso: "conteo" },
      { href: "/inventario/programacion", icon: "🗓️", label: "Programación de Conteos",  permiso: "programarConteo", badge: "programacion" },
    ],
  },
  {
    label: "Producción",
    icon: "🏭",
    items: [
      { href: "/productos/bom", icon: "📐", label: "Recetas de Producción", permiso: "productos" },
      { href: "/produccion",    icon: "🏭", label: "Órdenes de Producción", permiso: "productos" },
      { href: "/mrp",           icon: "⚙️",  label: "MRP · Planificación" },
    ],
  },
  {
    label: "Compras",
    icon: "🚚",
    items: [
      { href: "/compras/facturas",    icon: "📄", label: "Facturas de Compra",     permiso: "compras" },
      { href: "/compras/recepciones", icon: "🚚", label: "Recepción de Mercancía", permiso: "compras" },
      { href: "/compras/proveedores", icon: "🏢", label: "Proveedores",            permiso: "compras" },
    ],
  },
  {
    label: "Finanzas",
    icon: "💰",
    items: [
      { href: "/nomina",             icon: "👷", label: "Nómina",              permiso: "gastos" },
      { href: "/gastos",             icon: "💸", label: "Gastos",              permiso: "gastos" },
      { href: "/cuentas-por-cobrar", icon: "💳", label: "Cuentas por Cobrar",  permiso: "reportes", badge: "cxc" },
      { href: "/tesoreria",          icon: "🏦", label: "Planif. de Pagos",    permiso: "gastos" },
      { href: "/cuentas-por-pagar",  icon: "📤", label: "Cuentas por Pagar" },
      { href: "/analisis-financiero",icon: "📊", label: "Análisis Financiero" },
    ],
  },
  {
    label: "Reportes & CRM",
    icon: "📈",
    items: [
      { href: "/dashboard",   icon: "📈", label: "Dashboard",   permiso: "dashboard" },
      { href: "/reportes",    icon: "📑", label: "Reportes",    permiso: "reportes" },
      { href: "/ia-analisis", icon: "🤖", label: "IA Análisis" },
      { href: "/clientes",    icon: "👤", label: "Clientes",    permiso: "ventas" },
      { href: "/crm",         icon: "🤝", label: "CRM" },
    ],
  },
  {
    label: "Admin",
    icon: "🔧",
    items: [
      { href: "/admin",         icon: "🔧", label: "Configuración",        rolReq: "ADMIN" },
      { href: "/configuracion", icon: "📐", label: "Maestros del Sistema", rolReq: "ADMIN" },
    ],
  },
];

// Grupos colapsables por defecto (todos menos Principal)
const DEFAULT_COLLAPSED = new Set(
  GRUPOS.filter((g) => !g.noCollapse).map((g) => g.label)
);

function labelToSlug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function isVisible(item: NavItem, rol: Rol | null, permisos: PermisosUsuario | null): boolean {
  if (item.rolReq) return rol === item.rolReq;
  if (!item.permiso) return true;
  if (rol === "ADMIN") return true;
  return !!permisos?.[item.permiso];
}

function GroupLabel({
  label, icon, collapsed, groupCollapsed, onToggleCollapse, groupBadge, noCollapse,
}: {
  label: string;
  icon?: string;
  collapsed: boolean;
  groupCollapsed: boolean;
  onToggleCollapse: () => void;
  groupBadge?: "outstock";
  noCollapse?: boolean;
}) {
  if (noCollapse) return null;
  if (collapsed) return null; // collapsed mode handled separately

  return (
    <button
      type="button"
      onClick={onToggleCollapse}
      className="w-full flex items-center gap-1.5 px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
      style={{ color: "var(--erp-text-3)", background: "transparent", border: "none", cursor: "pointer" }}
    >
      {icon && <span style={{ fontSize: 13, opacity: .8 }}>{icon}</span>}
      <span className="flex-1 text-left">{label}</span>
      {groupBadge === "outstock" && !groupCollapsed && <OutstockAlerta collapsed={false} />}
      <span style={{ fontSize: 10, opacity: .7, transform: groupCollapsed ? "rotate(-90deg)" : "none", display: "inline-block", transition: "transform .15s" }}>
        ▾
      </span>
    </button>
  );
}

export default function SidebarNav({ rol, permisos }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(DEFAULT_COLLAPSED);

  const puedeVerReportes = rol === "ADMIN" || !!permisos?.reportes;

  const collapsableLabels = GRUPOS.filter((g) => !g.noCollapse).map((g) => g.label);

  const saveGroups = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem("sidebar-groups-collapsed", JSON.stringify([...next]));
    } catch { /* ignore */ }
  }, []);

  // Accordion: expand one group, collapse the rest
  const toggleGroupCollapse = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const isCurrentlyCollapsed = prev.has(label);
      let next: Set<string>;
      if (isCurrentlyCollapsed) {
        // Expand this one, collapse all others
        next = new Set(collapsableLabels.filter((l) => l !== label));
      } else {
        // Collapse this one
        next = new Set(prev);
        next.add(label);
      }
      saveGroups(next);
      return next;
    });
  }, [collapsableLabels, saveGroups]);

  const expandAll = useCallback(() => {
    const next = new Set<string>();
    saveGroups(next);
    setCollapsedGroups(next);
  }, [saveGroups]);

  const collapseAll = useCallback(() => {
    const next = new Set(collapsableLabels);
    saveGroups(next);
    setCollapsedGroups(next);
  }, [collapsableLabels, saveGroups]);

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      if (saved === "true") {
        setCollapsed(true);
        document.documentElement.style.setProperty("--sidebar-w", "56px");
      }
      const savedGroups = localStorage.getItem("sidebar-groups-collapsed");
      if (savedGroups) {
        setCollapsedGroups(new Set(JSON.parse(savedGroups) as string[]));
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-expand group that contains the active route
  useEffect(() => {
    const activeGroup = GRUPOS.find(
      (g) => !g.noCollapse && g.items.some((item) => {
        const [itemPath] = item.href.split("?");
        return pathname?.startsWith(itemPath) && !item.href.includes("?");
      })
    );
    if (activeGroup) {
      setCollapsedGroups((prev) => {
        if (!prev.has(activeGroup.label)) return prev;
        const next = new Set(prev);
        next.delete(activeGroup.label);
        return next;
      });
    }
  }, [pathname]);

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

      {!collapsed && (
        <div
          className="flex items-center gap-1 px-3 pb-1 pt-0.5 shrink-0"
          style={{ borderBottom: "1px solid var(--erp-border)" }}
        >
          <button
            type="button"
            onClick={expandAll}
            className="flex-1 py-1 text-[10px] rounded transition-colors hover:opacity-80"
            style={{ color: "var(--erp-text-3)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            ↕ Expandir todo
          </button>
          <span style={{ color: "var(--erp-border)", fontSize: 12 }}>|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="flex-1 py-1 text-[10px] rounded transition-colors hover:opacity-80"
            style={{ color: "var(--erp-text-3)", background: "transparent", border: "none", cursor: "pointer" }}
          >
            ↕ Colapsar todo
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {GRUPOS.map((grupo) => {
          const visibles = grupo.items.filter((item) => isVisible(item, rol, permisos));
          if (!visibles.length) return null;
          const isGroupCollapsed = !collapsed && !grupo.noCollapse && collapsedGroups.has(grupo.label);

          // Collapsed sidebar (56px): show group icon or individual items for noCollapse
          if (collapsed && !grupo.noCollapse) {
            const firstItem = visibles[0];
            const anyActive = visibles.some((item) => {
              const [itemPath] = item.href.split("?");
              return pathname?.startsWith(itemPath) && !item.href.includes("?");
            });
            return (
              <div key={grupo.label} className="mb-0.5">
                <Link
                  href={firstItem.href}
                  title={grupo.label}
                  className="relative flex items-center justify-center py-[9px] transition-colors"
                  style={{
                    background: anyActive ? "var(--erp-primary-lt)" : undefined,
                    borderLeft: anyActive ? "3px solid var(--erp-primary)" : "3px solid transparent",
                    color: anyActive ? "var(--erp-primary)" : "var(--erp-text-2)",
                  }}
                >
                  <span className="text-[18px]">{grupo.icon}</span>
                  {grupo.groupBadge === "outstock" && <OutstockAlerta collapsed={true} />}
                </Link>
              </div>
            );
          }

          return (
            <div key={grupo.label} className="mb-1">
              <GroupLabel
                label={grupo.label}
                icon={grupo.icon}
                collapsed={collapsed}
                groupCollapsed={isGroupCollapsed}
                onToggleCollapse={() => toggleGroupCollapse(grupo.label)}
                groupBadge={grupo.groupBadge}
                noCollapse={grupo.noCollapse}
              />
              {isGroupCollapsed ? null : visibles.map((item) => {
                const [itemPath, itemQuery] = item.href.split("?");
                const itemParams = itemQuery ? new URLSearchParams(itemQuery) : null;
                const active = itemParams
                  ? pathname === itemPath && [...itemParams.entries()].every(([k, v]) => searchParams.get(k) === v)
                  : pathname?.startsWith(item.href) && !item.href.includes("?");
                const indented = !collapsed && !grupo.noCollapse;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className="flex items-center gap-2 py-[6px] text-[12px] transition-colors"
                    style={{
                      paddingLeft: collapsed ? 0 : indented ? 20 : 12,
                      paddingRight: collapsed ? 0 : 10,
                      justifyContent: collapsed ? "center" : undefined,
                      borderLeft: !collapsed && active
                        ? "3px solid var(--erp-primary)"
                        : !collapsed ? "3px solid transparent" : undefined,
                      background: active ? "var(--erp-primary-lt)" : undefined,
                      color: active ? "var(--erp-primary)" : indented ? "var(--erp-text-2)" : "var(--erp-text)",
                      fontWeight: active ? 600 : 400,
                      opacity: indented && !active ? 0.85 : 1,
                    }}
                  >
                    <span className="shrink-0 text-center text-[14px]" style={{ width: collapsed ? "100%" : 15, opacity: indented ? 0.75 : 1 }}>{item.icon}</span>
                    {!collapsed && <span className="flex-1 leading-tight">{item.label}</span>}
                    {!collapsed && item.badge === "cxc" && puedeVerReportes && <CuentasPorCobrarAlerta />}
                    {!collapsed && item.badge === "cashea" && puedeVerReportes && <CasheaAlerta />}
                    {!collapsed && item.badge === "conteo" && <ConteoAlerta />}
                    {!collapsed && item.badge === "programacion" && <ConteoProgramacionAlerta />}
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
          VentasHG v3.1.0 · © 2026 HG
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

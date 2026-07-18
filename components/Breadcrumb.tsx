"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = { label: string; href?: string };

const PATH_MAP: Record<string, Crumb[]> = {
  "/ventas":             [{ label: "Punto de Venta", href: "/ventas" }],
  "/pedidos-pendientes": [{ label: "Punto de Venta", href: "/ventas" }, { label: "Pedidos Pendientes" }],
  "/productos":          [{ label: "Inventario", href: "/productos" }, { label: "Productos" }],
  "/inventarios":        [{ label: "Inventario", href: "/productos" }, { label: "Stock & Costos" }],
  "/compras":            [{ label: "Compras" }, { label: "Órdenes de Compra" }],
  "/mrp":                [{ label: "Producción" }, { label: "MRP · Planificación" }],
  "/nomina":             [{ label: "Nómina & Gastos" }, { label: "Nómina" }],
  "/gastos":             [{ label: "Nómina & Gastos" }, { label: "Gastos" }],
  "/reportes":           [{ label: "Reportes" }],
  "/dashboard":          [{ label: "Reportes", href: "/reportes" }, { label: "Dashboard" }],
  "/delivery":                [{ label: "Punto de Venta" }, { label: "Deliveries" }],
  "/clientes":               [{ label: "CRM" }, { label: "Clientes" }],
  "/crm":                    [{ label: "CRM" }],
  "/cuentas-por-pagar":      [{ label: "Finanzas" }, { label: "Cuentas por Pagar" }],
  "/analisis-financiero":    [{ label: "Finanzas" }, { label: "Análisis Financiero" }],
  "/cuentas-por-cobrar":     [{ label: "Finanzas" }, { label: "Cuentas por Cobrar" }],
  "/ia-analisis":            [{ label: "Reportes & AI KPI" }, { label: "IA Análisis" }],
  "/admin":              [{ label: "Configuración" }],
  "/sin-acceso":         [{ label: "Sin acceso" }],
};

export default function Breadcrumb() {
  const pathname = usePathname() ?? "/";

  if (pathname === "/") return null;

  const crumbs: Crumb[] =
    Object.entries(PATH_MAP).find(([k]) => pathname.startsWith(k))?.[1] ?? [];

  if (!crumbs.length) return null;

  const all: Crumb[] = [{ label: "Inicio", href: "/" }, ...crumbs];

  return (
    <nav
      className="flex items-center gap-1 text-[11px] mb-4 flex-wrap"
      style={{ color: "var(--erp-text-3)" }}
      aria-label="Ubicación"
    >
      {all.map((crumb, i) => {
        const isLast = i === all.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span>›</span>}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="hover:underline transition-colors"
                style={{ color: "var(--erp-primary)" }}
              >
                {crumb.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? "var(--erp-text-2)" : undefined }}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermisosUsuario, Rol } from "@/lib/types";
import CuentasPorCobrarAlerta from "@/components/CuentasPorCobrarAlerta";
import CasheaAlerta from "@/components/CasheaAlerta";

const TABS: { href: string; label: string; permiso?: keyof PermisosUsuario }[] = [
  { href: "/productos", label: "Productos", permiso: "productos" },
  { href: "/inventarios", label: "Inventarios", permiso: "productos" },
  { href: "/ventas", label: "Ventas", permiso: "ventas" },
  { href: "/reportes", label: "Reportes", permiso: "reportes" },
  { href: "/pedidos-pendientes", label: "Pedidos Pendientes", permiso: "pedidosPendientes" },
  { href: "/dashboard", label: "Dashboard", permiso: "dashboard" },
  { href: "/delivery", label: "Delivery" },
  { href: "/admin", label: "Admin" },
];

type Props = {
  rol: Rol | null;
  permisos: PermisosUsuario | null;
};

export default function NavTabs({ rol, permisos }: Props) {
  const pathname = usePathname();

  if (pathname?.startsWith("/delivery")) {
    return (
      <nav className="mt-3 flex gap-2 overflow-x-auto">
        <Link
          href="/delivery"
          className="shrink-0 rounded-t-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Delivery
        </Link>
      </nav>
    );
  }

  const tabs = TABS.filter((tab) => {
    if (tab.href === "/admin") return rol === "ADMIN";
    if (tab.href === "/delivery") return true;
    if (rol === "ADMIN") return true;
    if (!tab.permiso || !permisos) return false;
    return permisos[tab.permiso];
  });

  const puedeVerReportes = rol === "ADMIN" || !!permisos?.reportes;

  return (
    <nav className="mt-3 flex items-center gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 rounded-t-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 ${
              active
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      {puedeVerReportes && <CuentasPorCobrarAlerta />}
      {puedeVerReportes && <CasheaAlerta />}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermisosUsuario, Rol } from "@/lib/types";

const TABS: { href: string; label: string; permiso?: keyof PermisosUsuario }[] = [
  { href: "/productos", label: "Productos", permiso: "productos" },
  { href: "/ventas", label: "Ventas", permiso: "ventas" },
  { href: "/reportes", label: "Reportes", permiso: "reportes" },
  { href: "/pedidos-pendientes", label: "Pedidos Pendientes", permiso: "pedidosPendientes" },
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
      <nav className="mt-3 flex gap-2">
        <Link
          href="/delivery"
          className="rounded-t-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors"
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

  return (
    <nav className="mt-3 flex gap-2">
      {tabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

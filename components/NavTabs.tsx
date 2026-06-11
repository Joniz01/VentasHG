"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/productos", label: "Productos" },
  { href: "/ventas", label: "Ventas" },
  { href: "/reportes", label: "Reportes" },
  { href: "/pedidos-pendientes", label: "Pedidos Pendientes" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-3 flex gap-2">
      {TABS.map((tab) => {
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

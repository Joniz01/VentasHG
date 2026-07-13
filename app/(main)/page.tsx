import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, getUsuarioFromSession } from "@/lib/auth";
import type { PermisosUsuario, Rol } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tile = {
  href: string;
  icon: string;
  label: string;
  sub?: string;
  color: string;
  permiso?: keyof PermisosUsuario;
  rolReq?: Rol;
  new?: boolean;
};

type TileGroup = { label: string; tiles: Tile[] };

const GRUPOS: TileGroup[] = [
  {
    label: "Punto de Venta",
    tiles: [
      { href: "/ventas",             icon: "🛒", label: "Registrar Venta",    sub: "Nueva transacción",     color: "#EA6B0A", permiso: "ventas" },
      { href: "/pedidos-pendientes", icon: "📋", label: "Pedidos Pendientes", sub: "Por preparar o entregar", color: "#1D4ED8", permiso: "pedidosPendientes" },
    ],
  },
  {
    label: "Inventario",
    tiles: [
      { href: "/productos",   icon: "📦", label: "Productos",      sub: "Catálogo y categorías", color: "#1D4ED8", permiso: "productos" },
      { href: "/inventarios", icon: "📊", label: "Stock & Costos", sub: "Niveles y valorización", color: "#1D4ED8", permiso: "productos" },
    ],
  },
  {
    label: "Compras & Producción",
    tiles: [
      { href: "/compras", icon: "🛍️", label: "Órdenes de Compra", sub: "Facturas y proveedores", color: "#15803D", permiso: "compras", new: true },
      { href: "/mrp",     icon: "⚙️", label: "MRP · Planificación", sub: "Requerimientos de materiales", color: "#9333EA", new: true },
    ],
  },
  {
    label: "Nómina & Finanzas",
    tiles: [
      { href: "/nomina",   icon: "👷", label: "Nómina & Gastos",  sub: "Empleados y gastos operativos", color: "#9333EA", new: true },
      { href: "/cuentas-por-cobrar", icon: "💳", label: "Cuentas por Cobrar", sub: "CxC Directa, Cashea y Yummy", color: "#B45309", permiso: "reportes" },
      { href: "/delivery", icon: "📬", label: "Deliveries",       sub: "Pedidos a domicilio",            color: "#15803D" },
    ],
  },
  {
    label: "Reportes & Admin",
    tiles: [
      { href: "/dashboard", icon: "📈", label: "Dashboard",      sub: "Métricas y gráficas", color: "#1D4ED8", permiso: "dashboard" },
      { href: "/reportes",  icon: "📑", label: "Reportes",       sub: "Ventas y resúmenes",  color: "#1D4ED8", permiso: "reportes" },
      { href: "/admin",     icon: "🔧", label: "Configuración",  sub: "Usuarios y config",   color: "#475569", rolReq: "ADMIN" },
    ],
  },
];

function tileVisible(tile: Tile, rol: Rol | null, permisos: PermisosUsuario | null): boolean {
  if (tile.rolReq) return rol === tile.rolReq;
  if (!tile.permiso) return true;
  if (rol === "ADMIN") return true;
  return !!permisos?.[tile.permiso];
}

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) redirect("/admin");

  const hoy = new Date().toLocaleDateString("es-VE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const nombre = sesion.nombre ?? sesion.usuario ?? "Usuario";
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="max-w-4xl">
      {/* Welcome banner */}
      <div
        className="mb-6 rounded-xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap overflow-hidden relative"
        style={{ background: "var(--erp-shell)" }}
      >
        {/* Decorative circle */}
        <div
          className="absolute right-[-40px] top-[-40px] w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "rgba(255,255,255,.04)" }}
        />
        <div>
          <p className="text-lg font-bold text-white">
            {saludo}, {nombre.split(" ")[0]} 👋
          </p>
          <p className="text-xs mt-0.5 capitalize" style={{ color: "rgba(255,255,255,.55)" }}>
            {hoy}
          </p>
        </div>
      </div>

      {/* Tile groups */}
      {GRUPOS.map((grupo) => {
        const visibles = grupo.tiles.filter((t) =>
          tileVisible(t, sesion.rol, sesion.permisos)
        );
        if (!visibles.length) return null;

        return (
          <div key={grupo.label} className="mb-6">
            <div
              className="flex items-center gap-3 mb-3 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--erp-text-3)" }}
            >
              {grupo.label}
              <span
                className="flex-1 h-px"
                style={{ background: "var(--erp-border)" }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visibles.map((tile) => (
                <Link
                  key={tile.href + tile.label}
                  href={tile.href}
                  className="group flex flex-col gap-2.5 rounded-xl border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    background: "var(--erp-surface)",
                    borderColor: "var(--erp-border)",
                    borderTopColor: tile.color,
                    borderTopWidth: "3px",
                  }}
                >
                  <span className="text-2xl">{tile.icon}</span>
                  <div>
                    <div
                      className="text-[12.5px] font-bold leading-tight"
                      style={{ color: "var(--erp-text)" }}
                    >
                      {tile.label}
                      {tile.new && (
                        <span
                          className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: "#EDE9FE", color: "#7C3AED" }}
                        >
                          NUEVO
                        </span>
                      )}
                    </div>
                    {tile.sub && (
                      <div
                        className="text-[11px] mt-0.5 leading-tight"
                        style={{ color: "var(--erp-text-3)" }}
                      >
                        {tile.sub}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

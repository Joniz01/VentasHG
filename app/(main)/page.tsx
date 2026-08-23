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
      { href: "/ventas",                        icon: "🛒", label: "Registrar Venta",    sub: "Nueva transacción",        color: "#EA6B0A", permiso: "ventas" },
      { href: "/pedidos-pendientes",            icon: "📋", label: "Pedidos Pendientes", sub: "Por preparar o entregar",  color: "#1D4ED8", permiso: "pedidosPendientes" },
      { href: "/delivery",                      icon: "📬", label: "Deliveries",         sub: "Pedidos a domicilio",      color: "#15803D" },
      { href: "/ventas?vista=cortesias",        icon: "🎁", label: "Salida Cortesías",   sub: "Salidas sin cobro",        color: "#7C3AED", permiso: "ventas" },
      { href: "/ventas?vista=promociones",      icon: "🏷️", label: "Promociones",        sub: "Descuentos y combos",      color: "#0891B2", permiso: "ventas" },
      { href: "/ventas?vista=notas",            icon: "📝", label: "Notas de Entrega",   sub: "Órdenes de despacho",      color: "#15803D", permiso: "ventas" },
    ],
  },
  {
    label: "Reportes & KPI",
    tiles: [
      { href: "/dashboard",     icon: "📈", label: "Dashboard",       sub: "Métricas y gráficas",         color: "#1D4ED8", permiso: "dashboard" },
      { href: "/reportes",      icon: "📑", label: "Reportes",        sub: "Ventas y resúmenes",          color: "#1D4ED8", permiso: "reportes" },
      { href: "/ia-analisis",   icon: "🤖", label: "IA Análisis",     sub: "Análisis inteligente con IA", color: "#7C3AED", new: true },
    ],
  },
  {
    label: "CRM",
    tiles: [
      { href: "/clientes", icon: "👤", label: "Clientes", sub: "Gestión de clientes",   color: "#0891B2", new: true },
      { href: "/crm",      icon: "🤝", label: "CRM",      sub: "Relación con clientes", color: "#0891B2", new: true },
    ],
  },
  {
    label: "Inventario",
    tiles: [
      { href: "/productos",          icon: "📦", label: "Productos",                sub: "Catálogo y categorías",      color: "#1D4ED8", permiso: "productos" },
      { href: "/inventario",         icon: "🚦", label: "Dashboard Stock",          sub: "Alertas y existencias",      color: "#15803D", permiso: "productos", new: true },
      { href: "/inventarios",        icon: "📊", label: "Inventario y Movimientos", sub: "Valorización y movimientos", color: "#1D4ED8", permiso: "productos" },
      { href: "/inventario/conteos", icon: "📋", label: "Bandeja Conteos",          sub: "Control de conteo físico",   color: "#7C3AED", permiso: "autorizarConteo" },
    ],
  },
  {
    label: "Compras & Producción",
    tiles: [
      { href: "/compras", icon: "🛍️", label: "Órdenes de Compra",   sub: "Facturas y proveedores",       color: "#15803D", permiso: "compras", new: true },
      { href: "/mrp",     icon: "⚙️",  label: "MRP · Planificación", sub: "Requerimientos de materiales", color: "#9333EA", new: true },
    ],
  },
  {
    label: "Nómina & Gastos",
    tiles: [
      { href: "/nomina",  icon: "👷", label: "Nómina",  sub: "Empleados y períodos de pago", color: "#9333EA", new: true },
      { href: "/gastos",  icon: "💸", label: "Gastos",  sub: "Materia prima y operación",    color: "#9333EA", permiso: "gastos", new: true },
    ],
  },
  {
    label: "Finanzas",
    tiles: [
      { href: "/cuentas-por-cobrar",  icon: "💳", label: "Cuentas por Cobrar",  sub: "CxC Directa, Cashea y Yummy", color: "#B45309", permiso: "reportes" },
      { href: "/cuentas-por-pagar",   icon: "📤", label: "Cuentas por Pagar",   sub: "Pagos y obligaciones",         color: "#B45309", new: true },
      { href: "/analisis-financiero", icon: "📊", label: "Análisis Financiero", sub: "Indicadores y flujo de caja",  color: "#B45309", new: true },
    ],
  },
  {
    label: "Admin & Configuración",
    tiles: [
      { href: "/admin", icon: "🔧", label: "Configuración", sub: "Usuarios y config", color: "#475569", rolReq: "ADMIN" },
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
        className="mb-6 rounded-xl px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)" }}
      >
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
            {saludo}, {nombre.split(" ")[0]} 👋
          </p>
          <p className="text-xs mt-0.5 capitalize" style={{ color: "var(--erp-text-3)" }}>
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

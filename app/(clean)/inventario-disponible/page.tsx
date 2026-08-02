import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

type Producto = {
  nombre: string;
  stockActual: number;
  unidadMedida: string;
  categoriaNombre: string | null;
};

async function getData(): Promise<{ nombreEmpresa: string; productos: Producto[] }> {
  try {
    const [prodRes, configRes] = await Promise.all([
      pool.query(`
        SELECT p.nombre, p.stock_actual, p.unidad_medida, c.nombre AS categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.activo = TRUE
          AND COALESCE(p.grupo, 'PARA_LA_VENTA') = 'PARA_LA_VENTA'
          AND p.stock_actual > 0
          AND COALESCE(p.alerta_outstock_desactivada, FALSE) = FALSE
        ORDER BY COALESCE(c.orden, 99) ASC, c.nombre ASC NULLS LAST, p.nombre ASC
      `),
      pool.query(`SELECT valor FROM configuracion WHERE clave = 'nombre_empresa'`),
    ]);
    return {
      nombreEmpresa: configRes.rows[0]?.valor ?? "",
      productos: prodRes.rows.map((r) => ({
        nombre: r.nombre,
        stockActual: Number(r.stock_actual),
        unidadMedida: r.unidad_medida ?? "unidad",
        categoriaNombre: r.categoria_nombre ?? null,
      })),
    };
  } catch {
    return { nombreEmpresa: "", productos: [] };
  }
}

export default async function InventarioDisponiblePage() {
  const { nombreEmpresa, productos } = await getData();

  // Agrupar por categoría
  const grupos: Record<string, Producto[]> = {};
  for (const p of productos) {
    const cat = p.categoriaNombre ?? "Sin categoría";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(p);
  }

  const fecha = new Date().toLocaleDateString("es-VE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", justifyContent: "center", padding: "1.5rem 1rem" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Header */}
        <div>
          {nombreEmpresa && (
            <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 0.2rem 0" }}>
              {nombreEmpresa}
            </p>
          )}
          <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#111827" }}>
            ✅ Inventario Disponible
          </h1>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8rem", color: "#6b7280" }}>{fecha}</p>
        </div>

        {/* Badge total */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "0.5rem 0.9rem", display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>Productos disponibles</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#166534" }}>{productos.length}</span>
          </div>
        </div>

        {/* Productos por categoría */}
        {Object.entries(grupos).map(([cat, items]) => (
          <div key={cat}>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9ca3af" }}>
              {cat}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {items.map((p) => (
                <div
                  key={p.nombre}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.5rem 0.75rem",
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #f3f4f6",
                  }}
                >
                  <span style={{ fontSize: "0.9rem", color: "#16a34a", flexShrink: 0 }}>✓</span>
                  <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 500, color: "#111827" }}>{p.nombre}</span>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#374151", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {p.stockActual} {p.unidadMedida}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {productos.length === 0 && (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.875rem", padding: "2rem 0" }}>
            No hay productos disponibles en este momento.
          </p>
        )}

        <p style={{ margin: 0, fontSize: "0.72rem", color: "#d1d5db", textAlign: "center" }}>
          Actualizado automáticamente · VentasHG
        </p>
      </div>
    </div>
  );
}

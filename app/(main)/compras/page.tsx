export default function ComprasPage() {
  return (
    <div>
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Compras
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            Órdenes de Compra
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Gestión de compras a proveedores · Al recibir una OC, el stock se actualiza automáticamente
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
          style={{ background: "var(--erp-primary)" }}
        >
          + Nueva OC
        </button>
      </div>

      {/* Coming soon card */}
      <div
        className="rounded-xl border p-10 text-center"
        style={{
          background: "var(--erp-surface)",
          borderColor: "var(--erp-border)",
        }}
      >
        <div className="text-5xl mb-4">🛍️</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--erp-text)" }}>
          Módulo Compras — En construcción
        </h2>
        <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--erp-text-2)" }}>
          Este módulo estará disponible próximamente. Permitirá gestionar órdenes de compra,
          proveedores y recepciones, actualizando el inventario automáticamente al confirmar
          la llegada de mercancía.
        </p>

        <div
          className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto text-left"
        >
          {[
            { icon: "📋", title: "Órdenes de Compra", desc: "Crea y aprueba OCs con múltiples líneas de producto" },
            { icon: "🏭", title: "Proveedores", desc: "Directorio de proveedores con historial de precios" },
            { icon: "📥", title: "Recepciones", desc: "Confirma la llegada y actualiza stock automáticamente" },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-lg p-4 border"
              style={{ background: "var(--erp-bg)", borderColor: "var(--erp-border)" }}
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-xs font-bold mb-1" style={{ color: "var(--erp-text)" }}>{f.title}</div>
              <div className="text-xs" style={{ color: "var(--erp-text-2)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

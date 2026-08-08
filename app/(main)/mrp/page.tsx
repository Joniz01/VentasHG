export default function MrpPage() {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Producción › MRP
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            MRP — Planificación de Materiales
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Calcula los requerimientos de materia prima según la demanda proyectada y el stock disponible
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
          style={{ background: "var(--erp-primary)" }}
        >
          🔄 Recalcular
        </button>
      </div>

      <div
        className="rounded-xl border p-10 text-center"
        style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
      >
        <div className="text-5xl mb-4">⚙️</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--erp-text)" }}>
          Módulo MRP — En construcción
        </h2>
        <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--erp-text-2)" }}>
          La planificación de requerimientos de materiales estará disponible una vez que
          el módulo de Compras y las recetas de producción estén configurados.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto text-left">
          {[
            { icon: "📐", title: "Recetas / Fórmulas", desc: "Define los insumos necesarios para producir cada producto" },
            { icon: "📊", title: "Análisis de Stock", desc: "Compara stock disponible vs requerido por período" },
            { icon: "💡", title: "OC Sugeridas", desc: "Genera automáticamente órdenes de compra cuando el stock baja del mínimo" },
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

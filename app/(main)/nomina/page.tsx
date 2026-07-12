export default function NominaPage() {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--erp-text-3)" }}>
            Inicio › Nómina & Gastos
          </p>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--erp-text)" }}>
            Nómina & Gastos Operativos
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--erp-text-2)" }}>
            Registro de empleados, quincenas y gastos fijos y variables del negocio
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
          style={{ background: "var(--erp-primary)" }}
        >
          + Registrar Gasto
        </button>
      </div>

      <div
        className="rounded-xl border p-10 text-center"
        style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
      >
        <div className="text-5xl mb-4">👷</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--erp-text)" }}>
          Módulo Nómina — En construcción
        </h2>
        <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--erp-text-2)" }}>
          Próximamente podrás registrar empleados, calcular quincenas y llevar el control
          de todos los gastos operativos del negocio para obtener el margen neto real.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto text-left">
          {[
            { icon: "👥", title: "Empleados", desc: "Registro de empleados con cargo, salario y datos de contacto" },
            { icon: "📅", title: "Quincenas", desc: "Registro de pagos por quincena con historial y estado de pago" },
            { icon: "💸", title: "Gastos Operativos", desc: "Alquiler, servicios, marketing y otros gastos fijos y variables" },
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

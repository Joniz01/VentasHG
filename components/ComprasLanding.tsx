"use client";
import Link from "next/link";

export default function ComprasLanding() {
  return (
    <div className="max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/compras/facturas"
          className="group flex flex-col gap-3 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)", borderTopColor: "var(--erp-primary)", borderTopWidth: 3 }}
        >
          <span className="text-3xl">🧾</span>
          <div>
            <div className="text-base font-bold" style={{ color: "var(--erp-text)" }}>Compras / Facturas</div>
            <div className="text-sm mt-1" style={{ color: "var(--erp-text-2)" }}>
              Registra facturas de proveedores y actualiza el inventario automáticamente
            </div>
          </div>
        </Link>

        <div
          className="flex flex-col gap-3 rounded-xl border p-6 opacity-60 cursor-not-allowed"
          style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)", borderTopColor: "var(--erp-text-3)", borderTopWidth: 3 }}
        >
          <span className="text-3xl">📋</span>
          <div>
            <div className="flex items-center gap-2 text-base font-bold" style={{ color: "var(--erp-text)" }}>
              Órdenes de Compra
              <span style={{ background: "#EDE9FE", color: "#7C3AED", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>PRÓXIMO</span>
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--erp-text-2)" }}>
              Crea y aprueba órdenes de compra antes de recibir la mercancía
            </div>
          </div>
        </div>

        <Link
          href="/compras/proveedores"
          className="group flex flex-col gap-3 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)", borderTopColor: "var(--erp-primary)", borderTopWidth: 3 }}
        >
          <span className="text-3xl">👥</span>
          <div>
            <div className="text-base font-bold" style={{ color: "var(--erp-text)" }}>Proveedores</div>
            <div className="text-sm mt-1" style={{ color: "var(--erp-text-2)" }}>
              Gestiona tus proveedores y sus condiciones de crédito
            </div>
          </div>
        </Link>

        <Link
          href="/compras/recepciones"
          className="group flex flex-col gap-3 rounded-xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)", borderTopColor: "var(--erp-primary)", borderTopWidth: 3 }}
        >
          <span className="text-3xl">📦</span>
          <div>
            <div className="text-base font-bold" style={{ color: "var(--erp-text)" }}>Recepción de Mercancía</div>
            <div className="text-sm mt-1" style={{ color: "var(--erp-text-2)" }}>
              Registra mercancía recibida antes de tener la factura
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

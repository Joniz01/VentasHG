import { requirePermiso } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function IAAnalisisPage() {
  await requirePermiso("reportes");
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--erp-text)", marginBottom: 4 }}>IA Análisis</h2>
      <p style={{ fontSize: 13, color: "var(--erp-text-2)", marginBottom: 20 }}>Análisis inteligente con inteligencia artificial — próximamente.</p>
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--erp-text-3)", border: "1px dashed var(--erp-border)", borderRadius: 12, fontSize: 14 }}>
        🤖 En construcción
      </div>
    </div>
  );
}

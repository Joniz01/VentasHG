type Props = {
  icon: string;
  titulo: string;
  descripcion: string;
  detalles?: string[];
};

export default function ProximamentePage({ icon, titulo, descripcion, detalles }: Props) {
  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: 560 }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{icon}</div>
      <h1 style={{ margin: "0 0 0.4rem 0", fontSize: "1.25rem", fontWeight: 800, color: "var(--erp-text-1)" }}>
        {titulo}
      </h1>
      <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.875rem", color: "var(--erp-text-3)", lineHeight: 1.6 }}>
        {descripcion}
      </p>
      {detalles && detalles.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {detalles.map((d) => (
            <li key={d} style={{ fontSize: "0.8rem", color: "var(--erp-text-3)" }}>{d}</li>
          ))}
        </ul>
      )}
      <div style={{
        marginTop: "1.75rem",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "var(--erp-surface-2)",
        border: "1px solid var(--erp-border)",
        borderRadius: 8,
        padding: "0.45rem 0.9rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: "var(--erp-text-3)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}>
        🔧 En construcción
      </div>
    </div>
  );
}

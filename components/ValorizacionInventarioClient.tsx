"use client";

import { useState, useEffect } from "react";

type ProductoValor = {
  id: number;
  nombre: string;
  stockActual: number;
  unidadMedida: string;
  categoriaNombre: string | null;
  costoPromUsd: number | null;
  costoPromBs: number | null;
  valorTotalUsd: number | null;
  valorTotalBs: number | null;
};

type Data = {
  tasaActual: number;
  totalUsd: number;
  totalBs: number;
  productos: ProductoValor[];
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("es-VE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function ValorizacionInventarioClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [moneda, setMoneda] = useState<"usd" | "bs">("usd");
  const [ordenCol, setOrdenCol] = useState<"nombre" | "stock" | "costo" | "valor">("valor");
  const [ordenDir, setOrdenDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/inventario/valorizacion")
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error ?? "Error al cargar")))
      .then((d) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Calculando valorización…</div>;
  if (error || !data) return <div style={{ padding: 24, color: "#b91c1c", fontSize: 13 }}>{error ?? "Sin datos"}</div>;

  // Filtrar y ordenar
  let productos = data.productos.filter((p) =>
    !busqueda.trim() ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  productos = [...productos].sort((a, b) => {
    let va = 0, vb = 0;
    if (ordenCol === "nombre") return ordenDir === "asc" ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre);
    if (ordenCol === "stock")  { va = a.stockActual; vb = b.stockActual; }
    if (ordenCol === "costo")  { va = moneda === "usd" ? (a.costoPromUsd ?? 0) : (a.costoPromBs ?? 0); vb = moneda === "usd" ? (b.costoPromUsd ?? 0) : (b.costoPromBs ?? 0); }
    if (ordenCol === "valor")  { va = moneda === "usd" ? (a.valorTotalUsd ?? 0) : (a.valorTotalBs ?? 0); vb = moneda === "usd" ? (b.valorTotalUsd ?? 0) : (b.valorTotalBs ?? 0); }
    return ordenDir === "asc" ? va - vb : vb - va;
  });

  // Agrupar por categoría para el desglose
  const porCategoria: Record<string, { totalUsd: number; totalBs: number; count: number }> = {};
  for (const p of data.productos) {
    const cat = p.categoriaNombre ?? "Sin categoría";
    if (!porCategoria[cat]) porCategoria[cat] = { totalUsd: 0, totalBs: 0, count: 0 };
    porCategoria[cat].totalUsd += p.valorTotalUsd ?? 0;
    porCategoria[cat].totalBs  += p.valorTotalBs  ?? 0;
    porCategoria[cat].count++;
  }
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1].totalUsd - a[1].totalUsd);

  function thStyle(col: string): React.CSSProperties {
    return {
      padding: "0.35rem 0.75rem", textAlign: col === "nombre" ? "left" : "right",
      fontSize: "0.68rem", fontWeight: 700, color: ordenCol === col ? "#1D4ED8" : "var(--erp-text-3)",
      textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer",
      background: "var(--erp-surface-2)", borderBottom: "1px solid var(--erp-border)",
      userSelect: "none",
    };
  }

  function toggleOrden(col: typeof ordenCol) {
    if (ordenCol === col) setOrdenDir((d) => d === "asc" ? "desc" : "asc");
    else { setOrdenCol(col); setOrdenDir("desc"); }
  }

  const sinCosto = productos.filter((p) => p.costoPromUsd === null).length;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 960, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--erp-text-1)" }}>
          💰 Valorización de Inventario
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--erp-text-3)" }}>
          Costo promedio ponderado · Tasa BCV: <strong>Bs {fmt(data.tasaActual)}</strong>
        </p>
      </div>

      {/* KPIs principales */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ background: "#eff6ff", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 160 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Valor total (USD)</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1D4ED8", fontVariantNumeric: "tabular-nums" }}>$ {fmt(data.totalUsd)}</span>
        </div>
        <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 160 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>Valor total (Bs)</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", fontVariantNumeric: "tabular-nums" }}>Bs {fmt(data.totalBs, 0)}</span>
        </div>
        <div style={{ background: "var(--erp-surface-2)", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 130 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Productos</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{data.productos.length}</span>
        </div>
        {sinCosto > 0 && (
          <div style={{ background: "#fffbeb", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 140 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#B45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sin costo registrado</span>
            <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#B45309", fontVariantNumeric: "tabular-nums" }}>{sinCosto}</span>
          </div>
        )}
      </div>

      {/* Desglose por categoría */}
      <div>
        <h2 style={{ margin: "0 0 0.6rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--erp-text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Por categoría
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {categoriasOrdenadas.map(([cat, vals]) => {
            const pct = data.totalUsd > 0 ? (vals.totalUsd / data.totalUsd) * 100 : 0;
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--erp-text-2)", minWidth: 140, flexShrink: 0 }}>{cat}</span>
                <div style={{ flex: 1, height: 8, background: "var(--erp-surface-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#1D4ED8", borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--erp-text-2)", minWidth: 80, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  $ {fmt(vals.totalUsd)}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--erp-text-3)", minWidth: 38, textAlign: "right" }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controles tabla */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <input
            type="text" placeholder="Buscar producto o categoría…" value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%", padding: "0.5rem 0.8rem", fontSize: "0.875rem",
              border: "1px solid var(--erp-border)", borderRadius: 8,
              background: "var(--erp-surface-1)", color: "var(--erp-text-1)",
              outline: "none", boxSizing: "border-box",
            }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--erp-text-3)" }}>✕</button>
          )}
        </div>
        <div style={{ display: "flex", border: "1px solid var(--erp-border)", borderRadius: 7, overflow: "hidden" }}>
          {(["usd", "bs"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMoneda(m)}
              style={{
                padding: "0.45rem 0.9rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                background: moneda === m ? "#1D4ED8" : "var(--erp-surface-1)",
                color: moneda === m ? "#fff" : "var(--erp-text-2)",
              }}
            >{m.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
        {/* Cabecera */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 100px 110px 120px" }}>
          <span style={thStyle("nombre")} onClick={() => toggleOrden("nombre")}>
            Producto {ordenCol === "nombre" ? (ordenDir === "asc" ? "↑" : "↓") : ""}
          </span>
          <span style={{ ...thStyle("stock") }} onClick={() => toggleOrden("stock")}>
            Stock {ordenCol === "stock" ? (ordenDir === "asc" ? "↑" : "↓") : ""}
          </span>
          <span style={thStyle("costo")} onClick={() => toggleOrden("costo")}>
            CPP {ordenCol === "costo" ? (ordenDir === "asc" ? "↑" : "↓") : ""}
          </span>
          <span style={thStyle("valor")} onClick={() => toggleOrden("valor")}>
            Valor total {ordenCol === "valor" ? (ordenDir === "asc" ? "↑" : "↓") : ""}
          </span>
          <span style={{ ...thStyle("valor"), color: "var(--erp-text-3)" }}>% del total</span>
        </div>

        {productos.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Sin resultados</div>
        ) : (
          productos.map((p, idx) => {
            const valorTotal = moneda === "usd" ? p.valorTotalUsd : p.valorTotalBs;
            const costoUn   = moneda === "usd" ? p.costoPromUsd  : p.costoPromBs;
            const totalRef  = moneda === "usd" ? data.totalUsd    : data.totalBs;
            const pct = totalRef > 0 && valorTotal ? (valorTotal / totalRef) * 100 : 0;
            const prefix = moneda === "usd" ? "$" : "Bs";

            return (
              <div
                key={p.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 90px 100px 110px 120px",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  borderBottom: idx < productos.length - 1 ? "1px solid var(--erp-border)" : "none",
                  background: "var(--erp-surface-1)",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--erp-text-1)" }}>{p.nombre}</div>
                  {p.categoriaNombre && <div style={{ fontSize: "0.68rem", color: "var(--erp-text-3)" }}>{p.categoriaNombre}</div>}
                </div>
                <div style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>
                  {p.stockActual} <span style={{ fontSize: "0.68rem" }}>{p.unidadMedida}</span>
                </div>
                <div style={{ textAlign: "right", fontSize: "0.8rem", fontVariantNumeric: "tabular-nums", color: costoUn === null ? "var(--erp-text-3)" : "var(--erp-text-2)" }}>
                  {costoUn !== null ? `${prefix} ${fmt(costoUn)}` : <span style={{ fontSize: "0.72rem" }}>Sin dato</span>}
                </div>
                <div style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valorTotal !== null ? "var(--erp-text-1)" : "var(--erp-text-3)" }}>
                  {valorTotal !== null ? `${prefix} ${fmt(valorTotal)}` : "—"}
                </div>
                <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--erp-text-3)", fontVariantNumeric: "tabular-nums" }}>
                  {valorTotal !== null ? `${pct.toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })
        )}

        {/* Footer totales */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 90px 100px 110px 120px",
          padding: "0.5rem 0.75rem",
          background: "var(--erp-surface-2)",
          borderTop: "2px solid var(--erp-border)",
        }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--erp-text-2)" }}>
            Total ({productos.length} productos)
          </span>
          <span />
          <span />
          <span style={{ textAlign: "right", fontSize: "0.875rem", fontWeight: 800, color: "#1D4ED8", fontVariantNumeric: "tabular-nums" }}>
            {moneda === "usd" ? `$ ${fmt(data.totalUsd)}` : `Bs ${fmt(data.totalBs, 0)}`}
          </span>
          <span style={{ textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "var(--erp-text-3)" }}>100%</span>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--erp-text-3)" }}>
        CPP = Costo Promedio Ponderado calculado sobre historial de compras activas.
        Productos sin compras registradas muestran "Sin dato".
      </p>
    </div>
  );
}

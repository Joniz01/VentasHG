"use client";

import { useState, useEffect, useCallback } from "react";

type Producto = {
  id: number;
  nombre: string;
  stockActual: number;
  unidadMedida: string;
  grupo: string;
  categoriaNombre: string | null;
  stockMinimo: number;
  cantidadReorden: number | null;
};

type Edicion = { stockMinimo: string; cantidadReorden: string };
type Estado = "alerta" | "ok" | "sin_regla";

function estadoProducto(p: Producto): Estado {
  if (p.stockMinimo === 0 && p.cantidadReorden === null) return "sin_regla";
  if (p.stockActual <= p.stockMinimo) return "alerta";
  return "ok";
}

export default function ReordenInventarioClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"TODOS" | "alerta" | "sin_regla">("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [ediciones, setEdiciones] = useState<Record<number, Edicion>>({});
  const [guardando, setGuardando] = useState<Record<number, boolean>>({});
  const [guardadoOk, setGuardadoOk] = useState<Record<number, boolean>>({});

  const cargar = useCallback(() => {
    setLoading(true);
    fetch("/api/inventario/reorden")
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(d.error ?? "Error al cargar")))
      .then((d) => setProductos(d.productos))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  function iniciarEdicion(p: Producto) {
    setEdiciones((prev) => ({
      ...prev,
      [p.id]: {
        stockMinimo: String(p.stockMinimo),
        cantidadReorden: p.cantidadReorden !== null ? String(p.cantidadReorden) : "",
      },
    }));
  }

  function cancelarEdicion(id: number) {
    setEdiciones((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function guardar(p: Producto) {
    const ed = ediciones[p.id];
    if (!ed) return;
    const stockMinimo = parseFloat(ed.stockMinimo);
    const cantidadReorden = ed.cantidadReorden.trim() !== "" ? parseFloat(ed.cantidadReorden) : null;
    if (isNaN(stockMinimo) || stockMinimo < 0) return;

    setGuardando((prev) => ({ ...prev, [p.id]: true }));
    try {
      const res = await fetch(`/api/inventario/reorden/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockMinimo, cantidadReorden }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setProductos((prev) => prev.map((x) => x.id === p.id ? { ...x, stockMinimo, cantidadReorden } : x));
      cancelarEdicion(p.id);
      setGuardadoOk((prev) => ({ ...prev, [p.id]: true }));
      setTimeout(() => setGuardadoOk((prev) => { const n = { ...prev }; delete n[p.id]; return n; }), 2000);
    } catch {
      alert("Error al guardar");
    } finally {
      setGuardando((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
    }
  }

  if (loading) return <div style={{ padding: 24, color: "var(--erp-text-3)", fontSize: 13 }}>Cargando reglas de reorden…</div>;
  if (error) return <div style={{ padding: 24, color: "#b91c1c", fontSize: 13 }}>{error}</div>;

  const enAlerta   = productos.filter((p) => estadoProducto(p) === "alerta").length;
  const sinRegla   = productos.filter((p) => estadoProducto(p) === "sin_regla").length;
  const conRegla   = productos.filter((p) => estadoProducto(p) !== "sin_regla").length;

  const lista = productos.filter((p) => {
    if (filtro === "alerta"    && estadoProducto(p) !== "alerta")    return false;
    if (filtro === "sin_regla" && estadoProducto(p) !== "sin_regla") return false;
    return !busqueda.trim() ||
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.categoriaNombre ?? "").toLowerCase().includes(busqueda.toLowerCase());
  });

  const semaforo = (p: Producto) => {
    const est = estadoProducto(p);
    if (est === "alerta")    return { icon: "🔴", color: "#b91c1c", label: "En alerta" };
    if (est === "sin_regla") return { icon: "⚪", color: "var(--erp-text-3)", label: "Sin configurar" };
    return { icon: "🟢", color: "#15803d", label: "OK" };
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 980, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--erp-text-1)" }}>
          🔁 Reglas de Reorden
        </h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "var(--erp-text-3)" }}>
          Define stock mínimo y cantidad a pedir — alimenta el MRP automáticamente.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ background: "#eff6ff", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 130 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Con regla activa</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1D4ED8", fontVariantNumeric: "tabular-nums" }}>{conRegla}</span>
        </div>
        <div style={{ background: enAlerta > 0 ? "#fef2f2" : "var(--erp-surface-2)", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 130 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: enAlerta > 0 ? "#b91c1c" : "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>En alerta</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: enAlerta > 0 ? "#b91c1c" : "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{enAlerta}</span>
        </div>
        <div style={{ background: sinRegla > 0 ? "#fffbeb" : "var(--erp-surface-2)", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 140 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: sinRegla > 0 ? "#B45309" : "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sin configurar</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: sinRegla > 0 ? "#B45309" : "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{sinRegla}</span>
        </div>
        <div style={{ background: "var(--erp-surface-2)", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", flexDirection: "column", gap: 2, minWidth: 130 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total productos</span>
          <span style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--erp-text-2)", fontVariantNumeric: "tabular-nums" }}>{productos.length}</span>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", border: "1px solid var(--erp-border)", borderRadius: 7, overflow: "hidden" }}>
          {([["TODOS", "Todos"], ["alerta", "🔴 En alerta"], ["sin_regla", "⚪ Sin configurar"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFiltro(val)} style={{
              padding: "0.45rem 0.9rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
              background: filtro === val ? "#1D4ED8" : "var(--erp-surface-1)",
              color: filtro === val ? "#fff" : "var(--erp-text-2)",
            }}>{label}</button>
          ))}
        </div>
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
      </div>

      {/* Tabla */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 10, overflow: "hidden" }}>
        {/* Cabecera */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 130px 110px", background: "var(--erp-surface-2)", borderBottom: "1px solid var(--erp-border)" }}>
          {["Producto", "Stock", "Stock mínimo", "Cant. reorden", ""].map((h, i) => (
            <span key={i} style={{
              padding: "0.35rem 0.75rem", fontSize: "0.68rem", fontWeight: 700,
              color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.05em",
              textAlign: i === 0 ? "left" : "right",
            }}>{h}</span>
          ))}
        </div>

        {lista.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Sin resultados</div>
        ) : lista.map((p, idx) => {
          const sem = semaforo(p);
          const ed = ediciones[p.id];
          const isGuardando = guardando[p.id];
          const isOk = guardadoOk[p.id];

          return (
            <div key={p.id} style={{
              display: "grid", gridTemplateColumns: "1fr 80px 120px 130px 110px",
              alignItems: "center", padding: "0.5rem 0.75rem",
              borderBottom: idx < lista.length - 1 ? "1px solid var(--erp-border)" : "none",
              background: "var(--erp-surface-1)",
            }}>
              {/* Nombre */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span title={sem.label}>{sem.icon}</span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--erp-text-1)" }}>{p.nombre}</span>
                </div>
                {p.categoriaNombre && <div style={{ fontSize: "0.68rem", color: "var(--erp-text-3)", marginLeft: "1.4rem" }}>{p.categoriaNombre}</div>}
              </div>

              {/* Stock actual */}
              <div style={{ textAlign: "right", fontSize: "0.8rem", color: sem.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {p.stockActual} <span style={{ fontSize: "0.68rem", fontWeight: 400, color: "var(--erp-text-3)" }}>{p.unidadMedida}</span>
              </div>

              {/* Stock mínimo editable */}
              <div style={{ textAlign: "right" }}>
                {ed ? (
                  <input
                    type="number" min="0" step="0.01" value={ed.stockMinimo}
                    onChange={(e) => setEdiciones((prev) => ({ ...prev, [p.id]: { ...prev[p.id], stockMinimo: e.target.value } }))}
                    style={{ width: "80px", padding: "0.25rem 0.4rem", fontSize: "0.8rem", textAlign: "right", border: "1px solid #1D4ED8", borderRadius: 5, background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontVariantNumeric: "tabular-nums" }}
                  />
                ) : (
                  <span
                    onClick={() => iniciarEdicion(p)}
                    style={{ fontSize: "0.8rem", color: p.stockMinimo > 0 ? "var(--erp-text-2)" : "var(--erp-text-3)", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}
                    title="Click para editar"
                  >
                    {p.stockMinimo > 0 ? `${p.stockMinimo} ${p.unidadMedida}` : <span style={{ fontSize: "0.72rem" }}>Sin definir</span>}
                  </span>
                )}
              </div>

              {/* Cantidad reorden editable */}
              <div style={{ textAlign: "right" }}>
                {ed ? (
                  <input
                    type="number" min="0" step="0.01" value={ed.cantidadReorden} placeholder="—"
                    onChange={(e) => setEdiciones((prev) => ({ ...prev, [p.id]: { ...prev[p.id], cantidadReorden: e.target.value } }))}
                    style={{ width: "90px", padding: "0.25rem 0.4rem", fontSize: "0.8rem", textAlign: "right", border: "1px solid #1D4ED8", borderRadius: 5, background: "var(--erp-surface-1)", color: "var(--erp-text-1)", fontVariantNumeric: "tabular-nums" }}
                  />
                ) : (
                  <span
                    onClick={() => iniciarEdicion(p)}
                    style={{ fontSize: "0.8rem", color: p.cantidadReorden !== null ? "var(--erp-text-2)" : "var(--erp-text-3)", cursor: "pointer", fontVariantNumeric: "tabular-nums" }}
                    title="Click para editar"
                  >
                    {p.cantidadReorden !== null ? `${p.cantidadReorden} ${p.unidadMedida}` : <span style={{ fontSize: "0.72rem" }}>Sin definir</span>}
                  </span>
                )}
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.3rem" }}>
                {ed ? (
                  <>
                    <button onClick={() => guardar(p)} disabled={isGuardando} style={{
                      padding: "0.3rem 0.6rem", border: "none", borderRadius: 5, cursor: "pointer",
                      background: "#1D4ED8", color: "#fff", fontSize: "0.75rem", fontWeight: 600,
                    }}>
                      {isGuardando ? "…" : "Guardar"}
                    </button>
                    <button onClick={() => cancelarEdicion(p.id)} style={{
                      padding: "0.3rem 0.5rem", border: "1px solid var(--erp-border)", borderRadius: 5, cursor: "pointer",
                      background: "var(--erp-surface-1)", color: "var(--erp-text-3)", fontSize: "0.75rem",
                    }}>✕</button>
                  </>
                ) : isOk ? (
                  <span style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 600 }}>✓ Guardado</span>
                ) : (
                  <button onClick={() => iniciarEdicion(p)} style={{
                    padding: "0.3rem 0.6rem", border: "1px solid var(--erp-border)", borderRadius: 5, cursor: "pointer",
                    background: "var(--erp-surface-1)", color: "var(--erp-text-2)", fontSize: "0.75rem",
                  }}>Editar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--erp-text-3)" }}>
        El MRP usará el stock mínimo como punto de reorden y la cantidad reorden como lote sugerido de compra.
        Haz clic en cualquier valor para editarlo directamente.
      </p>
    </div>
  );
}

"use client";

import { Fragment, useEffect, useState, FormEvent } from "react";
import type { EstadoStock, MovimientoInventario, Producto } from "@/lib/types";
import { ajustarCantidadConFlechas } from "@/lib/cantidad";

function computeEstadoStock(p: Producto): EstadoStock {
  if (p.alertaOutstockDesactivada) return "SIN_ALERTA";
  if (p.stockActual <= 0) return "AGOTADO";
  if (p.stockMinimo > 0 && p.stockActual <= p.stockMinimo) return "BAJO_MINIMO";
  return "SALUDABLE";
}

const ESTADO_STOCK_LABEL: Record<EstadoStock, string> = {
  AGOTADO: "Agotado",
  BAJO_MINIMO: "Bajo mínimo",
  SALUDABLE: "Saludable",
  SIN_ALERTA: "Sin alerta",
};

const ESTADO_STOCK_STYLE: Record<EstadoStock, React.CSSProperties> = {
  AGOTADO:     { background: "#fde9e9", color: "#b91c1c", fontWeight: 700 },
  BAJO_MINIMO: { background: "#fef3e0", color: "#92400e", fontWeight: 700 },
  SALUDABLE:   { background: "#eafbf1", color: "#15803d", fontWeight: 700 },
  SIN_ALERTA:  { background: "#f3f4f6", color: "#6b7280", fontWeight: 600 },
};

const TIPO_MOVIMIENTO_LABELS: Record<MovimientoInventario["tipo"], string> = {
  ENTRADA: "Entrada",
  AJUSTE: "Ajuste",
  VENTA: "Venta",
};

function formatFechaHora(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MovimientosProducto({
  producto,
  onStockChange,
}: {
  producto: Producto;
  onStockChange: (id: number, nuevoStock: number) => void;
}) {
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [loadingMov, setLoadingMov] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [stockActual, setStockActual] = useState(producto.stockActual);

  async function loadMovimientos() {
    try {
      const res = await fetch(`/api/productos/${producto.id}/inventario`);
      const data = (await res.json()) as MovimientoInventario[];
      setMovimientos(data);
    } catch {
      setError("No se pudo cargar el historial de inventario");
    } finally {
      setLoadingMov(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMovimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const cantidadNum = Number(cantidad);
    if (Number.isNaN(cantidadNum) || cantidadNum === 0) {
      setError("Indica una cantidad válida");
      return;
    }

    if (tipo === "ENTRADA" && cantidadNum <= 0) {
      setError("La cantidad de una entrada debe ser mayor a 0");
      return;
    }

    if (tipo === "AJUSTE" && !nota.trim()) {
      setError("Indica el motivo del ajuste");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/productos/${producto.id}/inventario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, cantidad: cantidadNum, nota: nota.trim() || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al registrar el movimiento");
      }

      setStockActual(data.stockActual);
      onStockChange(producto.id, data.stockActual);
      setCantidad("");
      setNota("");
      await loadMovimientos();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el movimiento");
    } finally {
      setSaving(false);
    }
  }

  if (producto.alertaOutstockDesactivada) {
    return (
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-700">
          Inventario de &quot;{producto.nombre}&quot; — Stock actual: {stockActual}
        </h4>
        <div style={{ background: "#fef3e0", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
          <strong>🔕 Alerta OutStock desactivada.</strong> Este producto está marcado como sin inventario activo (descontinuado, temporada o proveedor sin despacho).
          Para registrar un movimiento ve a la ficha del producto y desmarca el check <em>"Apagar Alerta OutStock"</em>.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-zinc-700">
        Inventario de &quot;{producto.nombre}&quot; — Stock actual: {stockActual}
      </h4>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">Tipo</label>
          <select
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ENTRADA" | "AJUSTE")}
          >
            <option value="ENTRADA">Entrada (agregar unidades)</option>
            <option value="AJUSTE">Ajuste (corrección)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">
            Cantidad {tipo === "AJUSTE" ? "(+ o -)" : ""}
          </label>
          <input
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            type="number"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(ajustarCantidadConFlechas(cantidad, e.target.value))}
            placeholder={tipo === "AJUSTE" ? "Ej: -2" : "Ej: 10"}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600">
            Nota {tipo === "AJUSTE" ? "(obligatoria)" : "(opcional)"}
          </label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Motivo"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Registrar
        </button>
      </form>

      {error && <div className="text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Fecha</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Tipo</th>
              <th className="px-3 py-1.5 text-right font-medium text-zinc-600">Cantidad</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Nota</th>
              <th className="px-3 py-1.5 text-left font-medium text-zinc-600">Quién</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loadingMov && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loadingMov && movimientos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center text-zinc-500">
                  Sin movimientos registrados
                </td>
              </tr>
            )}
            {movimientos.map((mov) => (
              <tr key={mov.id}>
                <td className="px-3 py-1.5 whitespace-nowrap">{formatFechaHora(mov.createdAt)}</td>
                <td className="px-3 py-1.5">{TIPO_MOVIMIENTO_LABELS[mov.tipo]}</td>
                <td className="px-3 py-1.5 text-right font-variant-numeric">
                  <span style={{ color: mov.cantidad > 0 ? "#15803d" : mov.cantidad < 0 ? "#dc2626" : undefined, fontWeight: 700 }}>
                    {mov.cantidad > 0 ? `+${mov.cantidad}` : mov.cantidad}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-zinc-600">{mov.nota ?? "-"}</td>
                <td className="px-3 py-1.5 text-zinc-500 whitespace-nowrap text-xs">
                  {mov.origen === "VENTA"
                    ? <span title={`Venta #${mov.ventaId ?? ""}`}>🛒 Sistema (venta)</span>
                    : mov.origen === "CONTEO"
                    ? <span>📋 Conteo</span>
                    : mov.usuarioNombre
                    ? <span>👤 {mov.usuarioNombre}</span>
                    : <span className="text-zinc-300">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type InventariosKpis = {
  productosEnStock: number;
  valorInventario: number;
  sinStock: number;
  unidadesTotales: number;
  entradasMesUsd: number;
  movimientosMes: number;
};

export default function InventariosClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [kpis, setKpis] = useState<InventariosKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    fetch("/api/productos")
      .then((r) => r.json())
      .then((data) => setProductos(data))
      .finally(() => setLoading(false));

    fetch("/api/inventarios/kpis")
      .then((r) => r.json())
      .then((data) => setKpis(data))
      .finally(() => setKpisLoading(false));
  }, []);

  function handleStockChange(id: number, nuevoStock: number) {
    setProductos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stockActual: nuevoStock } : p))
    );
    // Refrescar KPIs tras un movimiento
    fetch("/api/inventarios/kpis")
      .then((r) => r.json())
      .then((data) => setKpis(data));
  }

  const productosInventario = productos.filter((p) => p.tipoProducto === "NORMAL");

  const kpiCards = [
    {
      label: "Productos en Stock",
      value: kpisLoading ? "…" : String(kpis?.productosEnStock ?? 0),
      sub: "con unidades disponibles",
      color: "text-zinc-900",
    },
    {
      label: "Valor del Inventario",
      value: kpisLoading ? "…" : `$${(kpis?.valorInventario ?? 0).toFixed(2)}`,
      sub: "stock × costo",
      color: "text-emerald-700",
    },
    {
      label: "Sin Stock",
      value: kpisLoading ? "…" : String(kpis?.sinStock ?? 0),
      sub: "productos en 0 unidades",
      color: (kpis?.sinStock ?? 0) > 0 ? "text-red-600" : "text-zinc-900",
    },
    {
      label: "Unidades Totales",
      value: kpisLoading ? "…" : String(kpis?.unidadesTotales ?? 0),
      sub: "suma de todo el stock",
      color: "text-blue-700",
    },
    {
      label: "Entradas del Mes",
      value: kpisLoading ? "…" : `$${(kpis?.entradasMesUsd ?? 0).toFixed(2)}`,
      sub: "inversión en reabastecimiento",
      color: "text-violet-700",
    },
    {
      label: "Movimientos del Mes",
      value: kpisLoading ? "…" : String(kpis?.movimientosMes ?? 0),
      sub: "entradas y ajustes",
      color: "text-amber-700",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Botón pill toggle */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            showGrid
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Movimientos de Inventario
          {productosInventario.length > 0 && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${showGrid ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"}`}>
              {productosInventario.length}
            </span>
          )}
        </button>
      </div>

      {/* KPIs — se ocultan cuando el grid está abierto */}
      {!showGrid && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <span className="text-xs font-medium text-zinc-500">{card.label}</span>
              <span className={`truncate text-lg font-bold leading-tight ${card.color}`}>{card.value}</span>
              <span className="text-xs text-zinc-400">{card.sub}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grid de movimientos */}
      {showGrid && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Producto</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Categoría</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Stock actual</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Mínimo</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-600">Estado</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && productosInventario.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    No hay productos con inventario individual
                  </td>
                </tr>
              )}
              {productosInventario.map((producto) => {
                const estado = computeEstadoStock(producto);
                return (
                <Fragment key={producto.id}>
                  <tr>
                    <td className="px-4 py-2 font-medium">{producto.nombre}</td>
                    <td className="px-4 py-2 text-zinc-600">{producto.categoriaNombre ?? "-"}</td>
                    <td className="px-4 py-2 text-right font-variant-numeric">{producto.stockActual}</td>
                    <td className="px-4 py-2 text-right text-zinc-400 text-xs">{producto.stockMinimo > 0 ? producto.stockMinimo : "—"}</td>
                    <td className="px-4 py-2">
                      <span style={{ ...ESTADO_STOCK_STYLE[estado], fontSize: 11, padding: "2px 8px", borderRadius: 99, display: "inline-block" }}>
                        {ESTADO_STOCK_LABEL[estado]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setExpandedId(expandedId === producto.id ? null : producto.id)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                      >
                        {expandedId === producto.id ? "Ocultar" : "Movimientos"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === producto.id && (
                    <tr>
                      <td colSpan={6} className="bg-zinc-50 px-4 py-3">
                        <MovimientosProducto producto={producto} onStockChange={handleStockChange} />
                      </td>
                    </tr>
                  )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

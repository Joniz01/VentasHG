"use client";

import { Fragment, useEffect, useMemo, useState, FormEvent } from "react";
import Paginador from "@/components/Paginador";
import type { Categoria, Producto, TipoProducto } from "@/lib/types";
import { TIPOS_PRODUCTO, TIPO_PRODUCTO_LABELS } from "@/lib/types";
import ProductoExtrasPanel from "@/components/ProductoExtrasPanel";
import ProductoComponentesPanel from "@/components/ProductoComponentesPanel";

const NUEVA_CATEGORIA = "__nueva__";

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  costo: "",
  precioVenta: "",
  categoriaId: "",
  tipoProducto: "NORMAL" as TipoProducto,
  variadaRaciones: "3",
};

type ProductosKpis = {
  totalActivos: number;
  valorInventario: number;
  sinStock: number;
  unidadesHoy: number;
  topProductoNombre: string | null;
  topProductoUnidades: number | null;
  margenPromedio: number;
};

type SubTab = "crear" | "listado" | null;

export default function ProductosClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [nuevaCategoriaOrden, setNuevaCategoriaOrden] = useState("99");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"extras" | "componentes" | null>(null);
  const [orden, setOrden] = useState<"nombre" | "categoria">("categoria");
  const [subTab, setSubTab] = useState<SubTab>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(25);
  const [kpis, setKpis] = useState<ProductosKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const productoEnEdicion = editingId ? productos.find((p) => p.id === editingId) ?? null : null;

  const productosOrdenados = useMemo(() => {
    if (orden === "nombre") {
      return [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return productos;
  }, [productos, orden]);

  async function loadProductos() {
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      setProductos(data);
    } catch {
      setError("No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategorias() {
    try {
      const res = await fetch("/api/categorias");
      const data = await res.json();
      setCategorias(data);
    } catch {
      setError("No se pudieron cargar las categorías");
    }
  }

  async function loadKpis() {
    try {
      setKpisLoading(true);
      const res = await fetch("/api/productos/kpis");
      const data = await res.json();
      setKpis(data);
    } catch {
      // silent — KPIs no son críticos
    } finally {
      setKpisLoading(false);
    }
  }

  useEffect(() => {
    loadProductos();
    loadCategorias();
    loadKpis();
  }, []);

  function startEdit(producto: Producto) {
    setEditingId(producto.id);
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      costo: String(producto.costo),
      precioVenta: String(producto.precioVenta),
      categoriaId: producto.categoriaId ? String(producto.categoriaId) : "",
      tipoProducto: producto.tipoProducto,
      variadaRaciones: String(producto.variadaRaciones || 3),
    });
    setNuevaCategoriaNombre("");
    setSubTab("crear");

  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNuevaCategoriaNombre("");
    setNuevaCategoriaOrden("99");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    try {
      let categoriaId = form.categoriaId;

      if (categoriaId === NUEVA_CATEGORIA) {
        if (!nuevaCategoriaNombre.trim()) {
          throw new Error("El nombre de la nueva categoría es obligatorio");
        }
        const catRes = await fetch("/api/categorias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: nuevaCategoriaNombre.trim(), orden: Number(nuevaCategoriaOrden) || 99 }),
        });
        if (!catRes.ok) {
          const data = await catRes.json();
          throw new Error(data.error ?? "Error al crear la categoría");
        }
        const nuevaCategoria = await catRes.json();
        categoriaId = String(nuevaCategoria.id);
        await loadCategorias();
      }

      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        costo: Number(form.costo) || 0,
        precioVenta: Number(form.precioVenta) || 0,
        activo: true,
        categoriaId: categoriaId || null,
        tipoProducto: form.tipoProducto,
        variadaRaciones: form.tipoProducto === "VARIADA" ? Number(form.variadaRaciones) || 0 : 0,
      };

      const res = await fetch(
        editingId ? `/api/productos/${editingId}` : "/api/productos",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al guardar el producto");
      }

      const saved = await res.json();
      await loadProductos();
      await loadKpis();

      if (form.tipoProducto === "COMBO") {
        setEditingId(saved.id);
      } else {
        cancelEdit();
      }
      setNuevaCategoriaNombre("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;

    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar el producto");
      }
      await loadProductos();
      await loadKpis();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el producto");
    }
  }

  const kpiCards = [
    {
      label: "Productos Activos",
      value: kpisLoading ? "…" : String(kpis?.totalActivos ?? 0),
      sub: "en catálogo",
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
      label: "Unidades Vendidas Hoy",
      value: kpisLoading ? "…" : String(kpis?.unidadesHoy ?? 0),
      sub: "total unidades del día",
      color: "text-blue-700",
    },
    {
      label: "Producto Más Vendido",
      value: kpisLoading ? "…" : (kpis?.topProductoNombre ?? "—"),
      sub: kpisLoading ? "" : kpis?.topProductoUnidades ? `${kpis.topProductoUnidades} uds hoy` : "sin ventas hoy",
      color: "text-violet-700",
    },
    {
      label: "Margen Bruto Promedio",
      value: kpisLoading ? "…" : `${(kpis?.margenPromedio ?? 0).toFixed(1)}%`,
      sub: "sobre precio de venta",
      color: "text-amber-700",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-tab buttons — encima de los KPIs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab(subTab === "crear" ? null : "crear")}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            subTab === "crear"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          {editingId ? `Editando #${editingId}` : "Crear Producto"}
        </button>
        <button
          type="button"
          onClick={() => setSubTab(subTab === "listado" ? null : "listado")}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            subTab === "listado"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          Productos Creados
          {productos.length > 0 && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${subTab === "listado" ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"}`}>
              {productos.length}
            </span>
          )}
        </button>
      </div>

      {/* KPI Cards — se ocultan cuando hay un sub-tab activo */}
      {subTab === null && (
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

      {/* Crear Producto */}
      {subTab === "crear" && (
        <>
          {editingId && (
            <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>✏️ Editando producto #{editingId}</span>
              <button
                type="button"
                onClick={cancelEdit}
                className="ml-auto rounded border border-amber-300 px-2 py-0.5 text-xs hover:bg-amber-100"
              >
                Cancelar
              </button>
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Nombre</label>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: QT 80g"
                required
              />
            </div>
            <div className="flex flex-col gap-1 lg:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Descripción</label>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Categoría</label>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
                <option value={NUEVA_CATEGORIA}>+ Nueva categoría...</option>
              </select>
              {form.categoriaId === NUEVA_CATEGORIA && (
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={nuevaCategoriaNombre}
                    onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                    placeholder="Nombre de la nueva categoría"
                  />
                  <input
                    type="number"
                    min={1}
                    className="w-20 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={nuevaCategoriaOrden}
                    onChange={(e) => setNuevaCategoriaOrden(e.target.value)}
                    title="Orden (1=primero, 99=al final)"
                    placeholder="Orden"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Costo</label>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                min="0"
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Precio de venta</label>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                type="number"
                step="0.01"
                min="0"
                value={form.precioVenta}
                onChange={(e) => setForm({ ...form, precioVenta: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Tipo de producto</label>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={form.tipoProducto}
                onChange={(e) => setForm({ ...form, tipoProducto: e.target.value as TipoProducto })}
              >
                {TIPOS_PRODUCTO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_PRODUCTO_LABELS[tipo]}
                  </option>
                ))}
              </select>
            </div>
            {form.tipoProducto === "VARIADA" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Raciones a elegir</label>
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  type="number"
                  step="1"
                  min="1"
                  value={form.variadaRaciones}
                  onChange={(e) => setForm({ ...form, variadaRaciones: e.target.value })}
                  placeholder="3"
                />
              </div>
            )}
            <div className="flex items-end gap-2 lg:col-span-5">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                {editingId ? "Guardar cambios" : "Crear Producto"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {form.tipoProducto === "COMBO" && (
            <div className="rounded-lg border border-zinc-200 bg-white p-4">
              {productoEnEdicion ? (
                <ProductoComponentesPanel
                  producto={productoEnEdicion}
                  productos={productos}
                  onChange={loadProductos}
                />
              ) : (
                <p className="text-sm text-zinc-500">
                  Guarda el producto para poder configurar las bandejas (y cantidades) que descuenta este combo.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}
        </>
      )}

      {/* Productos Creados */}
      {subTab === "listado" && (
        <>
          {error && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-zinc-700">Ordenar por</label>
            <select
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={orden}
              onChange={(e) => setOrden(e.target.value as "nombre" | "categoria")}
            >
              <option value="nombre">Nombre</option>
              <option value="categoria">Categoría</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Nombre</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Categoría</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Tipo</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Costo</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Precio venta</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Margen</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Stock</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Extras</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && productos.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                      No hay productos registrados
                    </td>
                  </tr>
                )}
                {productosOrdenados
                  .slice((pagina - 1) * porPagina, pagina * porPagina)
                  .map((producto) => (
                    <Fragment key={producto.id}>
                      <tr>
                        <td className="px-4 py-2 font-medium">{producto.nombre}</td>
                        <td className="px-4 py-2 text-zinc-600">{producto.categoriaNombre ?? "-"}</td>
                        <td className="px-4 py-2 text-zinc-600">{TIPO_PRODUCTO_LABELS[producto.tipoProducto]}</td>
                        <td className="px-4 py-2 text-right">{producto.costo.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{producto.precioVenta.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">
                          {(producto.precioVenta - producto.costo).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {producto.tipoProducto === "NORMAL" ? producto.stockActual : "-"}
                        </td>
                        <td className="px-4 py-2 text-zinc-600">
                          {producto.extras.length === 0
                            ? "-"
                            : producto.extras
                                .map((extra) => `${extra.nombre} (+${extra.precioAdicional.toFixed(2)})`)
                                .join(", ")}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              onClick={() => {
                                setExpandedId(expandedId === producto.id && expandedPanel === "extras" ? null : producto.id);
                                setExpandedPanel("extras");
                              }}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                            >
                              Extras
                            </button>
                            {producto.tipoProducto === "COMBO" && (
                              <button
                                onClick={() => {
                                  setExpandedId(expandedId === producto.id && expandedPanel === "componentes" ? null : producto.id);
                                  setExpandedPanel("componentes");
                                }}
                                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                              >
                                Componentes
                              </button>
                            )}
                            <button
                              onClick={() => startEdit(producto)}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(producto.id)}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === producto.id && expandedPanel === "extras" && (
                        <tr>
                          <td colSpan={9} className="bg-zinc-50 px-4 py-3">
                            <ProductoExtrasPanel producto={producto} onChange={loadProductos} />
                          </td>
                        </tr>
                      )}
                      {expandedId === producto.id && expandedPanel === "componentes" && (
                        <tr>
                          <td colSpan={9} className="bg-zinc-50 px-4 py-3">
                            <ProductoComponentesPanel
                              producto={producto}
                              productos={productos}
                              onChange={loadProductos}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
              </tbody>
            </table>
            <Paginador
              total={productosOrdenados.length}
              pagina={pagina}
              porPagina={porPagina}
              opcionesPorPagina={[15, 25, 50, 100]}
              onPagina={setPagina}
              onPorPagina={setPorPagina}
            />
          </div>
        </>
      )}
    </div>
  );
}

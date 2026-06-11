"use client";

import { Fragment, useEffect, useMemo, useState, FormEvent } from "react";
import type { Categoria, Producto } from "@/lib/types";
import ProductoExtrasPanel from "@/components/ProductoExtrasPanel";

const NUEVA_CATEGORIA = "__nueva__";

const EMPTY_FORM = {
  nombre: "",
  descripcion: "",
  costo: "",
  precioVenta: "",
  categoriaId: "",
};

export default function ProductosClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [orden, setOrden] = useState<"nombre" | "categoria">("nombre");

  const productosOrdenados = useMemo(() => {
    if (orden === "nombre") return productos;

    return [...productos].sort((a, b) => {
      const categoriaCompare = (a.categoriaNombre ?? "").localeCompare(b.categoriaNombre ?? "");
      return categoriaCompare !== 0 ? categoriaCompare : a.nombre.localeCompare(b.nombre);
    });
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProductos();
    loadCategorias();
  }, []);

  function startEdit(producto: Producto) {
    setEditingId(producto.id);
    setForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      costo: String(producto.costo),
      precioVenta: String(producto.precioVenta),
      categoriaId: producto.categoriaId ? String(producto.categoriaId) : "",
    });
    setNuevaCategoriaNombre("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNuevaCategoriaNombre("");
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
          body: JSON.stringify({ nombre: nuevaCategoriaNombre.trim() }),
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

      cancelEdit();
      setNuevaCategoriaNombre("");
      await loadProductos();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar el producto");
    }
  }

  return (
    <div className="flex flex-col gap-6">
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
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={nuevaCategoriaNombre}
              onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
              placeholder="Nombre de la nueva categoría"
            />
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
        <div className="flex items-end gap-2 lg:col-span-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Agregar producto"}
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

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
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
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Descripción</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Costo</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Precio venta</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Margen</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Extras</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && productos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  No hay productos registrados
                </td>
              </tr>
            )}
            {productosOrdenados.map((producto) => (
              <Fragment key={producto.id}>
                <tr>
                  <td className="px-4 py-2 font-medium">{producto.nombre}</td>
                  <td className="px-4 py-2 text-zinc-600">{producto.categoriaNombre ?? "-"}</td>
                  <td className="px-4 py-2 text-zinc-600">{producto.descripcion}</td>
                  <td className="px-4 py-2 text-right">{producto.costo.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{producto.precioVenta.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">
                    {(producto.precioVenta - producto.costo).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {producto.extras.length === 0
                      ? "-"
                      : producto.extras
                          .map((extra) => `${extra.nombre} (+${extra.precioAdicional.toFixed(2)})`)
                          .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === producto.id ? null : producto.id)
                        }
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                      >
                        Extras
                      </button>
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
                {expandedId === producto.id && (
                  <tr>
                    <td colSpan={8} className="bg-zinc-50 px-4 py-3">
                      <ProductoExtrasPanel producto={producto} onChange={loadProductos} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

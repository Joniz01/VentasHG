"use client";

import { Fragment, useEffect, useMemo, useState, FormEvent } from "react";
import Paginador from "@/components/Paginador";
import type { Categoria, EmpaqueProducto, GrupoProducto, Producto, TipoProducto } from "@/lib/types";
import { GRUPOS_PRODUCTO, GRUPO_PRODUCTO_LABELS, TIPOS_PRODUCTO, TIPO_PRODUCTO_LABELS } from "@/lib/types";

type EmpaqueFormRow = {
  id?: number;
  empaqueId: string;
  rendimiento: string;
  prioridad: number;
  toDelete?: boolean;
};
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
  stockMinimo: "0",
  unidadMedida: "unidad",
  alertaOutstockDesactivada: false,
  alertaOutstockMotivo: "",
  grupo: "PARA_LA_VENTA" as GrupoProducto,
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

export default function ProductosClient({ grupoFiltro }: { grupoFiltro?: GrupoProducto }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, grupo: grupoFiltro ?? "PARA_LA_VENTA" as GrupoProducto });
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");
  const [nuevaCategoriaOrden, setNuevaCategoriaOrden] = useState("99");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<"extras" | "componentes" | null>(null);
  const [orden, setOrden] = useState<"nombre" | "categoria">("categoria");
  const [searchNombre, setSearchNombre] = useState("");
  const [filterCategoriaId, setFilterCategoriaId] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [showCategoriaForm, setShowCategoriaForm] = useState(false);
  const [catStandaloneNombre, setCatStandaloneNombre] = useState("");
  const [catStandaloneOrden, setCatStandaloneOrden] = useState("99");
  const [catStandaloneSaving, setCatStandaloneSaving] = useState(false);
  const [catStandaloneError, setCatStandaloneError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(15);
  const [kpis, setKpis] = useState<ProductosKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [formEmpaques, setFormEmpaques] = useState<EmpaqueFormRow[]>([]);
  const [tasaHoy, setTasaHoy] = useState<number | null>(null);
  const [grupoDropdownId, setGrupoDropdownId] = useState<number | null>(null);

  // Proveedores del insumo
  type ProveedorRelacion = {
    id: number; proveedorId: number; proveedorNombre: string; proveedorRif: string;
    precioRefUsd: number | null; tiempoEntregaDias: number; esPrincipal: boolean; notas: string;
  };
  const [provRelaciones, setProvRelaciones] = useState<ProveedorRelacion[]>([]);
  const [provSearch, setProvSearch] = useState("");
  const [provSearchResults, setProvSearchResults] = useState<{ id: number; nombre: string; rifCi: string }[]>([]);
  const [provSearchOpen, setProvSearchOpen] = useState(false);
  const [provForm, setProvForm] = useState({ proveedorId: 0, proveedorNombre: "", precioRefUsd: "", tiempoEntregaDias: "0", esPrincipal: false, notas: "" });
  const [provSaving, setProvSaving] = useState(false);

  const productoEnEdicion = editingId ? productos.find((p) => p.id === editingId) ?? null : null;

  const productosOrdenados = useMemo(() => {
    let list = [...productos];
    if (grupoFiltro) {
      list = list.filter((p) => (p.grupo ?? "PARA_LA_VENTA") === grupoFiltro);
    }
    if (searchNombre.trim()) {
      const q = searchNombre.trim().toLowerCase();
      list = list.filter((p) => p.nombre.toLowerCase().includes(q) || (p.categoriaNombre ?? "").toLowerCase().includes(q));
    }
    if (filterCategoriaId === "__sin__") {
      list = list.filter((p) => !p.categoriaId);
    } else if (filterCategoriaId) {
      list = list.filter((p) => String(p.categoriaId) === filterCategoriaId);
    }
    if (orden === "nombre") {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }
    return list;
  }, [productos, orden, searchNombre, filterCategoriaId]);

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

  async function handleCrearCategoriaStandalone() {
    if (!catStandaloneNombre.trim()) return;
    setCatStandaloneSaving(true);
    setCatStandaloneError(null);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: catStandaloneNombre.trim(), orden: Number(catStandaloneOrden) || 99 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al crear la categoría");
      await loadCategorias();
      setCatStandaloneNombre("");
      setCatStandaloneOrden("99");
      setShowCategoriaForm(false);
    } catch (err) {
      setCatStandaloneError(err instanceof Error ? err.message : "Error al crear la categoría");
    } finally {
      setCatStandaloneSaving(false);
    }
  }

  async function loadKpis() {
    try {
      setKpisLoading(true);
      const url = grupoFiltro ? `/api/productos/kpis?grupo=${grupoFiltro}` : "/api/productos/kpis";
      const res = await fetch(url);
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
    if (grupoFiltro === "MATERIA_PRIMA") {
      fetch("/api/tasa-bcv").then(r => r.ok ? r.json() : null).then(d => {
        if (d?.tasa) setTasaHoy(Number(d.tasa));
      }).catch(() => {});
    }
  }, []);

  async function loadProvRelaciones(productoId: number) {
    try {
      const r = await fetch(`/api/productos/${productoId}/proveedores`);
      if (r.ok) { const d = await r.json(); setProvRelaciones(d.items ?? []); }
    } catch { /* ignore */ }
  }

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
      stockMinimo: String(producto.stockMinimo ?? 0),
      unidadMedida: producto.unidadMedida ?? "unidad",
      alertaOutstockDesactivada: producto.alertaOutstockDesactivada ?? false,
      alertaOutstockMotivo: producto.alertaOutstockMotivo ?? "",
      grupo: producto.grupo ?? "PARA_LA_VENTA",
    });
    setNuevaCategoriaNombre("");
    setFormEmpaques((producto.empaques ?? []).map((e: EmpaqueProducto) => ({
      id: e.id,
      empaqueId: String(e.empaqueId),
      rendimiento: String(e.rendimiento),
      prioridad: e.prioridad,
    })));
    if (grupoFiltro === "MATERIA_PRIMA") {
      setProvRelaciones([]);
      setProvForm({ proveedorId: 0, proveedorNombre: "", precioRefUsd: "", tiempoEntregaDias: "0", esPrincipal: false, notas: "" });
      loadProvRelaciones(producto.id);
    }
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, grupo: grupoFiltro ?? "PARA_LA_VENTA" });
    setFormEmpaques([]);
    setProvRelaciones([]);
    setNuevaCategoriaNombre("");
    setNuevaCategoriaOrden("99");
    setShowForm(false);
  }

  async function buscarProveedores(q: string) {
    if (!q.trim()) { setProvSearchResults([]); setProvSearchOpen(false); return; }
    try {
      const r = await fetch(`/api/proveedores?q=${encodeURIComponent(q)}`);
      if (r.ok) { const d = await r.json(); setProvSearchResults(d.items ?? []); setProvSearchOpen(true); }
    } catch { /* ignore */ }
  }

  async function agregarProveedor() {
    if (!editingId || !provForm.proveedorId) return;
    setProvSaving(true);
    try {
      const r = await fetch(`/api/productos/${editingId}/proveedores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId: provForm.proveedorId,
          precioRefUsd: provForm.precioRefUsd ? Number(provForm.precioRefUsd) : null,
          tiempoEntregaDias: Number(provForm.tiempoEntregaDias) || 0,
          esPrincipal: provForm.esPrincipal,
          notas: provForm.notas,
        }),
      });
      if (r.ok) {
        await loadProvRelaciones(editingId);
        setProvForm({ proveedorId: 0, proveedorNombre: "", precioRefUsd: "", tiempoEntregaDias: "0", esPrincipal: false, notas: "" });
        setProvSearch("");
        setProvSearchOpen(false);
      }
    } finally { setProvSaving(false); }
  }

  async function quitarProveedor(proveedorId: number) {
    if (!editingId) return;
    await fetch(`/api/productos/${editingId}/proveedores?proveedorId=${proveedorId}`, { method: "DELETE" });
    await loadProvRelaciones(editingId);
  }

  async function togglePrincipal(rel: { id: number; proveedorId: number; precioRefUsd: number | null; tiempoEntregaDias: number; esPrincipal: boolean; notas: string }) {
    if (!editingId) return;
    await fetch(`/api/productos/${editingId}/proveedores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rel, esPrincipal: !rel.esPrincipal }),
    });
    await loadProvRelaciones(editingId);
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
        stockMinimo: Number(form.stockMinimo) || 0,
        unidadMedida: form.unidadMedida.trim() || "unidad",
        alertaOutstockDesactivada: form.alertaOutstockDesactivada,
        alertaOutstockMotivo: form.alertaOutstockDesactivada ? (form.alertaOutstockMotivo.trim() || null) : null,
        grupo: form.grupo,
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

      // Guardar empaques configurados
      const productoId = saved.id as number;
      const empaqueErrors: string[] = [];
      await Promise.all(
        formEmpaques.map(async (row) => {
          if (row.toDelete && row.id) {
            const r = await fetch(`/api/productos/${productoId}/empaques/${row.id}`, { method: "DELETE" });
            if (!r.ok) empaqueErrors.push(`Error eliminando empaque: ${(await r.json().catch(() => ({}))).error ?? r.status}`);
          } else if (!row.toDelete && row.empaqueId) {
            const r = await fetch(`/api/productos/${productoId}/empaques`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ empaqueId: Number(row.empaqueId), rendimiento: Number(row.rendimiento) || 1, prioridad: row.prioridad }),
            });
            if (!r.ok) empaqueErrors.push(`Error guardando empaque: ${(await r.json().catch(() => ({}))).error ?? r.status}`);
          }
        })
      );
      if (empaqueErrors.length > 0) {
        throw new Error(empaqueErrors.join(" | "));
      }

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

  async function handleCambiarGrupo(producto: Producto, nuevoGrupo: GrupoProducto) {
    setGrupoDropdownId(null);
    try {
      const res = await fetch(`/api/productos/${producto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? null,
          costo: producto.costo,
          precioVenta: producto.precioVenta,
          activo: true,
          categoriaId: producto.categoriaId ?? null,
          tipoProducto: producto.tipoProducto,
          variadaRaciones: producto.variadaRaciones ?? 0,
          stockMinimo: producto.stockMinimo ?? 0,
          unidadMedida: producto.unidadMedida ?? "unidad",
          alertaOutstockDesactivada: producto.alertaOutstockDesactivada ?? false,
          alertaOutstockMotivo: producto.alertaOutstockMotivo ?? null,
          grupo: nuevoGrupo,
        }),
      });
      if (res.ok) await loadProductos();
    } catch { /* ignore */ }
  }

  const kpiCards = [
    {
      label: grupoFiltro === "MATERIA_PRIMA" ? "Insumos Registrados" : "Productos Activos",
      value: kpisLoading ? "…" : String(kpis?.totalActivos ?? 0),
      sub: "en catálogo",
      color: "var(--erp-text)",
    },
    {
      label: "Valor del Inventario",
      value: kpisLoading ? "…" : `$${(kpis?.valorInventario ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: "stock × costo",
      color: "#059669",
    },
    {
      label: grupoFiltro === "MATERIA_PRIMA" ? "Insumos Sin Stock" : "Sin Stock",
      value: kpisLoading ? "…" : String(kpis?.sinStock ?? 0),
      sub: "en 0 unidades",
      color: (kpis?.sinStock ?? 0) > 0 ? "#dc2626" : "var(--erp-text)",
    },
    ...(grupoFiltro === "MATERIA_PRIMA" ? [] : [{
      label: "Unidades Vendidas Hoy",
      value: kpisLoading ? "…" : String(kpis?.unidadesHoy ?? 0),
      sub: "total unidades del día",
      color: "#2563eb",
    },
    {
      label: "Prod. Más Vendido",
      value: kpisLoading ? "…" : (kpis?.topProductoNombre ?? "—"),
      sub: kpisLoading ? "" : kpis?.topProductoUnidades ? `${kpis.topProductoUnidades} uds hoy` : "sin ventas hoy",
      color: "#7c3aed",
    },
    {
      label: "Margen Bruto Promedio",
      value: kpisLoading ? "…" : `${(kpis?.margenPromedio ?? 0).toFixed(1)}%`,
      sub: "sobre precio de venta",
      color: "#d97706",
    }]),
  ];

  return (
    <div className="flex flex-col gap-4" style={{ color: "var(--erp-text)" }}>
      {/* Header: título + botón Crear */}
      <div className="prod-header">
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          {grupoFiltro === "MATERIA_PRIMA" ? "Insumos / Materia Prima" : grupoFiltro === "PARA_LA_VENTA" ? "Productos de Venta" : "Productos"}
        </h2>
        <div className="prod-header-btns">
          <button
            type="button"
            onClick={() => {
              if (showForm && editingId) { cancelEdit(); } else { setShowForm((v) => !v); if (editingId) cancelEdit(); }
            }}
            style={{
              background: showForm ? "var(--erp-primary)" : "var(--erp-surface)",
              color: showForm ? "#fff" : "var(--erp-text)",
              border: "1px solid var(--erp-border)",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {editingId ? `✏️ Editando #${editingId}` : showForm ? "✕ Cerrar" : "+ Crear Producto"}
          </button>
          <button
            type="button"
            onClick={() => setShowCategoriaForm((v) => !v)}
            style={{
              background: showCategoriaForm ? "var(--erp-primary)" : "var(--erp-surface)",
              color: showCategoriaForm ? "#fff" : "var(--erp-text)",
              border: "1px solid var(--erp-border)",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {showCategoriaForm ? "✕ Cerrar" : "+ Crear Categoría"}
          </button>
        </div>
      </div>

      {showCategoriaForm && (
        <div style={{ background: "var(--erp-primary-lt)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-primary)" }}>Nueva categoría</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              style={{ flex: 1, minWidth: 180, border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
              value={catStandaloneNombre}
              onChange={(e) => setCatStandaloneNombre(e.target.value)}
              placeholder="Nombre de la categoría"
              autoFocus
            />
            <input
              type="number"
              min={1}
              style={{ width: 90, border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
              value={catStandaloneOrden}
              onChange={(e) => setCatStandaloneOrden(e.target.value)}
              title="Orden (1=primero, 99=al final)"
              placeholder="Orden"
            />
            <button
              type="button"
              onClick={handleCrearCategoriaStandalone}
              disabled={catStandaloneSaving || !catStandaloneNombre.trim()}
              style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: catStandaloneSaving || !catStandaloneNombre.trim() ? 0.6 : 1 }}
            >
              {catStandaloneSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
          {catStandaloneError && <div style={{ fontSize: 12, color: "#B91C1C" }}>{catStandaloneError}</div>}
        </div>
      )}

      {/* KPI Cards — se ocultan cuando el formulario está abierto o hay un panel de producto expandido */}
      {!showForm && !expandedId && <div className="prod-kpi-grid">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            style={{
              background: "var(--erp-surface)",
              border: "1px solid var(--erp-border)",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 3,
              minHeight: 84,
              height: "100%",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: card.color, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.value}</span>
            <span style={{ fontSize: 11, color: "var(--erp-text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.sub}</span>
          </div>
        ))}
      </div>}

      {/* Formulario Crear / Editar — colapsable */}
      {showForm && (
        <div
          style={{
            background: "var(--erp-surface)",
            border: "1px solid var(--erp-border)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          {editingId && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "6px 12px", marginBottom: 12, fontSize: 13, color: "#92400e" }}>
              <span>✏️ Editando producto #{editingId}</span>
              <button
                type="button"
                onClick={cancelEdit}
                style={{ marginLeft: "auto", background: "none", border: "1px solid #fcd34d", borderRadius: 4, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "#92400e" }}
              >
                Cancelar
              </button>
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="prod-form-grid"
          >
            <div className="flex flex-col gap-1 prod-form-col2">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Nombre</label>
              <input
                style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: QT 80g"
                required
              />
            </div>
            <div className="flex flex-col gap-1 prod-form-col2">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Descripción</label>
              <input
                style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Categoría</label>
              <select
                style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
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
                    style={{ flex: 1, border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                    value={nuevaCategoriaNombre}
                    onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                    placeholder="Nombre de la nueva categoría"
                  />
                  <input
                    type="number"
                    min={1}
                    style={{ width: 72, border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                    value={nuevaCategoriaOrden}
                    onChange={(e) => setNuevaCategoriaOrden(e.target.value)}
                    title="Orden (1=primero, 99=al final)"
                    placeholder="Orden"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Costo</label>
              <input
                style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                type="number"
                step="0.01"
                min="0"
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: e.target.value })}
                placeholder="0.00"
              />
            </div>
            {grupoFiltro !== "MATERIA_PRIMA" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Precio de venta</label>
                <input
                  style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precioVenta}
                  onChange={(e) => setForm({ ...form, precioVenta: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Tipo de producto</label>
              {grupoFiltro === "MATERIA_PRIMA" ? (
                <div style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--erp-text-2)", background: "var(--erp-bg)" }}>
                  Normal (con inventario)
                </div>
              ) : (
                <select
                  style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                  value={form.tipoProducto}
                  onChange={(e) => setForm({ ...form, tipoProducto: e.target.value as TipoProducto })}
                >
                  {TIPOS_PRODUCTO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {TIPO_PRODUCTO_LABELS[tipo]}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Grupo</label>
              {grupoFiltro === "MATERIA_PRIMA" ? (
                <div style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--erp-text-2)", background: "var(--erp-bg)" }}>
                  Materia Prima
                </div>
              ) : (
                <select
                  style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                  value={form.grupo}
                  onChange={(e) => setForm({ ...form, grupo: e.target.value as GrupoProducto })}
                >
                  {GRUPOS_PRODUCTO.map((g) => (
                    <option key={g} value={g}>{GRUPO_PRODUCTO_LABELS[g]}</option>
                  ))}
                </select>
              )}
            </div>

            {form.tipoProducto === "VARIADA" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Raciones a elegir</label>
                <input
                  style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                  type="number"
                  step="1"
                  min="1"
                  value={form.variadaRaciones}
                  onChange={(e) => setForm({ ...form, variadaRaciones: e.target.value })}
                  placeholder="3"
                />
              </div>
            )}
            {form.tipoProducto === "NORMAL" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Mínimo de existencia</label>
                  <input
                    style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                    type="number"
                    step="1"
                    min="0"
                    value={form.stockMinimo}
                    onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>Unidad de medida</label>
                  <input
                    style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13 }}
                    value={form.unidadMedida}
                    onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
                    placeholder="unidad, kg, lt…"
                  />
                </div>
              </>
            )}
            {editingId && form.tipoProducto === "NORMAL" && (
              <div className="prod-form-full">
                <div style={{ border: "1px solid", borderColor: form.alertaOutstockDesactivada ? "#f59e0b" : "var(--erp-border)", borderRadius: 8, padding: "10px 14px", background: form.alertaOutstockDesactivada ? "#fffbeb" : "transparent" }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.alertaOutstockDesactivada}
                      onChange={(e) => setForm({ ...form, alertaOutstockDesactivada: e.target.checked, alertaOutstockMotivo: e.target.checked ? form.alertaOutstockMotivo : "" })}
                      style={{ marginTop: 2, width: 16, height: 16, accentColor: "#f59e0b", flexShrink: 0 }}
                    />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: form.alertaOutstockDesactivada ? "#92400e" : "var(--erp-text)" }}>🔕 Apagar Alerta OutStock</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--erp-text-3)", marginTop: 2, lineHeight: 1.4 }}>
                        Producto descontinuado, de temporada o sin despacho del proveedor. No sumará a las alertas de stock.
                      </span>
                    </div>
                  </label>
                  {form.alertaOutstockDesactivada && (
                    <input
                      style={{ marginTop: 8, width: "100%", border: "1px solid #fcd34d", borderRadius: 6, padding: "6px 10px", fontSize: 13, background: "#fffbeb" }}
                      value={form.alertaOutstockMotivo}
                      onChange={(e) => setForm({ ...form, alertaOutstockMotivo: e.target.value })}
                      placeholder="Motivo (opcional): descontinuado / temporada / proveedor sin despacho…"
                    />
                  )}
                </div>
              </div>
            )}
            {/* ── Empaque & Rendimiento ── */}
            {form.tipoProducto === "NORMAL" && grupoFiltro !== "MATERIA_PRIMA" && (
              <div className="prod-form-full">
                <div style={{ border: "2px dashed var(--erp-accent)", borderRadius: 8, padding: "12px 14px", background: "color-mix(in srgb, var(--erp-accent) 4%, var(--erp-surface))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>📦</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-accent)" }}>Empaque &amp; Rendimiento</span>
                    <span style={{ fontSize: 10, fontWeight: 800, background: "var(--erp-accent)", color: "#fff", borderRadius: 999, padding: "1px 8px", letterSpacing: ".05em" }}>NUEVO</span>
                    <span style={{ fontSize: 11.5, color: "var(--erp-text-3)", marginLeft: 4 }}>Indica desde qué empaque se puede obtener este producto cuando no haya stock</span>
                  </div>

                  {formEmpaques.filter(r => !r.toDelete).map((row, i) => {
                    const empaqueProd = productos.find(p => String(p.id) === row.empaqueId);
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Empaque (producto origen)</div>
                          <select
                            style={{ width: "100%", background: "var(--erp-bg)", border: "1px solid var(--erp-accent)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--erp-text)" }}
                            value={row.empaqueId}
                            onChange={(e) => setFormEmpaques(prev => prev.map((r, idx) => idx === i ? { ...r, empaqueId: e.target.value } : r))}
                          >
                            <option value="">— seleccionar —</option>
                            {productos.filter(p => p.activo && p.id !== (editingId ?? 0)).map(p => (
                              <option key={p.id} value={String(p.id)}>{p.nombre} (stock: {p.stockActual})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Rinde (uds)</div>
                          <input
                            type="number" min="1"
                            style={{ width: "100%", background: "var(--erp-bg)", border: "1px solid var(--erp-accent)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--erp-text)" }}
                            value={row.rendimiento}
                            onChange={(e) => setFormEmpaques(prev => prev.map((r, idx) => idx === i ? { ...r, rendimiento: e.target.value } : r))}
                            placeholder="ej. 3"
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Prioridad</div>
                          <select
                            style={{ width: "100%", background: "var(--erp-bg)", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--erp-text)" }}
                            value={row.prioridad}
                            onChange={(e) => setFormEmpaques(prev => prev.map((r, idx) => idx === i ? { ...r, prioridad: Number(e.target.value) } : r))}
                          >
                            <option value={1}>1° Principal</option>
                            <option value={2}>2° Alternativo</option>
                            <option value={3}>3° Reserva</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormEmpaques(prev => prev.map((r, idx) => idx === i ? { ...r, toDelete: true } : r))}
                          style={{ background: "var(--erp-surface)", border: "1px solid #fca5a5", borderRadius: 6, padding: "7px 10px", color: "#dc2626", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                        >✕ Quitar</button>
                        {empaqueProd && row.rendimiento && (
                          <div style={{ gridColumn: "1 / -1", background: "var(--erp-bg)", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 12px", fontSize: 12, color: "var(--erp-text-2)", display: "flex", gap: 8, alignItems: "center" }}>
                            <span>📦 <strong>{empaqueProd.nombre}</strong> (stock: {empaqueProd.stockActual})</span>
                            <span style={{ color: "var(--erp-text-3)" }}>→</span>
                            <span>abriendo 1 se generan <strong style={{ color: "var(--erp-primary)" }}>{row.rendimiento} {form.unidadMedida || "unidad"}(es)</strong></span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {formEmpaques.filter(r => !r.toDelete).length < 3 && (
                    <button
                      type="button"
                      onClick={() => setFormEmpaques(prev => [...prev, { empaqueId: "", rendimiento: "", prioridad: formEmpaques.filter(r => !r.toDelete).length + 1 }])}
                      style={{ marginTop: 4, background: "transparent", border: "1px dashed var(--erp-accent)", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600, color: "var(--erp-accent)", cursor: "pointer" }}
                    >
                      + Agregar empaque
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Proveedores (solo Materia Prima en edición) ── */}
            {grupoFiltro === "MATERIA_PRIMA" && editingId && (
              <div className="prod-form-full">
                <div style={{ border: "1px solid var(--erp-border)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--erp-text)", marginBottom: 10 }}>
                    🏭 Proveedores
                  </div>

                  {/* Lista de proveedores vinculados */}
                  {provRelaciones.length > 0 && (
                    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                      {provRelaciones.map((rel) => (
                        <div key={rel.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--erp-bg)", borderRadius: 6, border: "1px solid var(--erp-border)" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--erp-text)" }}>{rel.proveedorNombre}</span>
                              {rel.proveedorRif && <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{rel.proveedorRif}</span>}
                              {rel.esPrincipal && (
                                <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, padding: "1px 7px" }}>Principal</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {rel.precioRefUsd != null && <span>Precio ref: <strong>${rel.precioRefUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>}
                              {rel.tiempoEntregaDias > 0 && <span>Entrega: <strong>{rel.tiempoEntregaDias}d</strong></span>}
                              {rel.notas && <span>{rel.notas}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            title={rel.esPrincipal ? "Quitar principal" : "Marcar como principal"}
                            onClick={() => togglePrincipal(rel)}
                            style={{ background: "transparent", border: "1px solid var(--erp-border)", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", color: rel.esPrincipal ? "#1d4ed8" : "var(--erp-text-3)", fontWeight: rel.esPrincipal ? 700 : 400 }}
                          >★</button>
                          <button
                            type="button"
                            onClick={() => quitarProveedor(rel.proveedorId)}
                            style={{ background: "transparent", border: "1px solid #fca5a5", borderRadius: 4, padding: "3px 7px", fontSize: 11, cursor: "pointer", color: "#dc2626" }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Agregar proveedor */}
                  <div style={{ borderTop: provRelaciones.length > 0 ? "1px solid var(--erp-border)" : "none", paddingTop: provRelaciones.length > 0 ? 10 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                      {provRelaciones.length === 0 ? "Agregar primer proveedor" : "+ Agregar proveedor"}
                    </div>

                    {/* Buscador */}
                    <div style={{ position: "relative", marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Buscar proveedor por nombre o RIF…"
                        value={provForm.proveedorId ? provForm.proveedorNombre : provSearch}
                        onChange={(e) => {
                          if (provForm.proveedorId) {
                            setProvForm({ ...provForm, proveedorId: 0, proveedorNombre: "" });
                          }
                          setProvSearch(e.target.value);
                          buscarProveedores(e.target.value);
                        }}
                        style={{ width: "100%", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
                      />
                      {provSearchOpen && provSearchResults.length > 0 && !provForm.proveedorId && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", maxHeight: 200, overflowY: "auto" }}>
                          {provSearchResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProvForm({ ...provForm, proveedorId: p.id, proveedorNombre: p.nombre });
                                setProvSearch(p.nombre);
                                setProvSearchOpen(false);
                              }}
                              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", background: "transparent", fontSize: 13, cursor: "pointer", color: "var(--erp-text)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--erp-bg)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                              {p.rifCi && <span style={{ fontSize: 11, color: "var(--erp-text-3)", marginLeft: 8 }}>{p.rifCi}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {provForm.proveedorId > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Precio ref. $</div>
                          <input
                            type="number" step="0.01" min="0"
                            placeholder="0.00"
                            value={provForm.precioRefUsd}
                            onChange={(e) => setProvForm({ ...provForm, precioRefUsd: e.target.value })}
                            style={{ width: "100%", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Entrega (días)</div>
                          <input
                            type="number" step="1" min="0"
                            placeholder="0"
                            value={provForm.tiempoEntregaDias}
                            onChange={(e) => setProvForm({ ...provForm, tiempoEntregaDias: e.target.value })}
                            style={{ width: "100%", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-text-3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>Notas</div>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={provForm.notas}
                            onChange={(e) => setProvForm({ ...provForm, notas: e.target.value })}
                            style={{ width: "100%", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 10px", fontSize: 13, boxSizing: "border-box" }}
                          />
                        </div>
                      </div>
                    )}

                    {provForm.proveedorId > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "var(--erp-text-2)" }}>
                          <input
                            type="checkbox"
                            checked={provForm.esPrincipal}
                            onChange={(e) => setProvForm({ ...provForm, esPrincipal: e.target.checked })}
                            style={{ width: 14, height: 14 }}
                          />
                          Proveedor principal
                        </label>
                        <button
                          type="button"
                          disabled={provSaving}
                          onClick={agregarProveedor}
                          style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: provSaving ? 0.5 : 1 }}
                        >
                          {provSaving ? "Guardando…" : "Agregar"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="prod-form-full" style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.5 : 1 }}
              >
                {editingId ? "Guardar cambios" : "Crear Producto"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{ background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {form.tipoProducto === "COMBO" && (
            <div style={{ marginTop: 12, background: "var(--erp-bg)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: 16 }}>
              {productoEnEdicion ? (
                <ProductoComponentesPanel
                  producto={productoEnEdicion}
                  productos={productos}
                  onChange={loadProductos}
                />
              ) : (
                <p style={{ fontSize: 13, color: "var(--erp-text-3)", margin: 0 }}>
                  Guarda el producto para poder configurar las bandejas (y cantidades) que descuenta este combo.
                </p>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{error}</div>
          )}
        </div>
      )}

      {/* Grid de productos — siempre visible */}
      <div
        style={{
          background: "var(--erp-surface)",
          border: "1px solid var(--erp-border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div className="prod-toolbar">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--erp-text-3)" }}>Buscar</label>
            <input
              type="search"
              placeholder="Nombre o categoría..."
              value={searchNombre}
              onChange={(e) => { setSearchNombre(e.target.value); setPagina(1); }}
              style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "6px 10px", fontSize: 13, minWidth: 160 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--erp-text-3)" }}>Categoría</label>
            <select
              style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
              value={filterCategoriaId}
              onChange={(e) => { setFilterCategoriaId(e.target.value); setPagina(1); }}
            >
              <option value="">Todas</option>
              <option value="__sin__">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--erp-text-3)" }}>Ordenar por</label>
            <select
              style={{ border: "1px solid var(--erp-border)", borderRadius: 6, padding: "6px 10px", fontSize: 13 }}
              value={orden}
              onChange={(e) => setOrden(e.target.value as "nombre" | "categoria")}
            >
              <option value="nombre">Nombre</option>
              <option value="categoria">Categoría</option>
            </select>
          </div>
          {(searchNombre || filterCategoriaId) && (
            <button
              type="button"
              onClick={() => { setSearchNombre(""); setFilterCategoriaId(""); setPagina(1); }}
              style={{ background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "6px 12px", fontSize: 13, color: "var(--erp-text-3)", cursor: "pointer", alignSelf: "flex-end" }}
            >
              Limpiar
            </button>
          )}
        </div>

        {!showForm && error && (
          <div style={{ margin: "0 16px 8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#dc2626" }}>{error}</div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)", borderBottom: "1px solid var(--erp-border)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Nombre</th>
                <th className="prod-col-cat" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Categoría</th>
                <th className="prod-col-tipo" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Tipo</th>
                {grupoFiltro !== "MATERIA_PRIMA" && (
                  <th className="prod-col-grupo" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Grupo</th>
                )}
                <th className="prod-col-costo" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                  {grupoFiltro === "MATERIA_PRIMA" ? "Costo $" : "Costo"}
                </th>
                {grupoFiltro === "MATERIA_PRIMA" ? (
                  <>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                      Costo Bs {tasaHoy ? <span style={{ fontSize: 10, fontWeight: 400 }}>(tasa {tasaHoy.toFixed(2)})</span> : ""}
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Stock</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Unidad</th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Precio</th>
                    <th className="prod-col-margen" style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Margen</th>
                    <th className="prod-col-extras" style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Extras</th>
                  </>
                )}
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={grupoFiltro === "MATERIA_PRIMA" ? 7 : 8} style={{ padding: "24px", textAlign: "center", color: "var(--erp-text-3)" }}>
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && productos.length === 0 && (
                <tr>
                  <td colSpan={grupoFiltro === "MATERIA_PRIMA" ? 7 : 8} style={{ padding: "24px", textAlign: "center", color: "var(--erp-text-3)" }}>
                    No hay productos registrados
                  </td>
                </tr>
              )}
              {productosOrdenados
                .slice((pagina - 1) * porPagina, pagina * porPagina)
                .map((producto) => (
                  <Fragment key={producto.id}>
                    <tr style={{ borderBottom: "1px solid var(--erp-border)" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 500 }}>
                        <div>{producto.nombre}</div>
                        <div className="prod-mobile-meta" style={{ fontSize: 11, color: "var(--erp-text-3)", display: "none" }}>
                          {producto.categoriaNombre ?? ""}{producto.categoriaNombre ? " · " : ""}{TIPO_PRODUCTO_LABELS[producto.tipoProducto]}
                        </div>
                      </td>
                      <td className="prod-col-cat" style={{ padding: "8px 12px", color: "var(--erp-text-2)" }}>{producto.categoriaNombre ?? "-"}</td>
                      <td className="prod-col-tipo" style={{ padding: "8px 12px", color: "var(--erp-text-2)" }}>{TIPO_PRODUCTO_LABELS[producto.tipoProducto]}</td>
                      {grupoFiltro !== "MATERIA_PRIMA" && <td className="prod-col-grupo" style={{ padding: "8px 12px" }}>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <button
                            type="button"
                            onClick={() => setGrupoDropdownId(grupoDropdownId === producto.id ? null : producto.id)}
                            style={{
                              fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 99, border: "none", cursor: "pointer",
                              background: producto.grupo === "PARA_LA_VENTA" ? "#dcfce7" : producto.grupo === "MATERIA_PRIMA" ? "#fef9c3" : "#ede9fe",
                              color: producto.grupo === "PARA_LA_VENTA" ? "#166534" : producto.grupo === "MATERIA_PRIMA" ? "#854d0e" : "#5b21b6",
                            }}
                            title="Cambiar grupo"
                          >
                            {GRUPO_PRODUCTO_LABELS[producto.grupo ?? "PARA_LA_VENTA"]} ▾
                          </button>
                          {grupoDropdownId === producto.id && (
                            <div style={{
                              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30,
                              background: "var(--erp-surface)", border: "1px solid var(--erp-border)",
                              borderRadius: 8, minWidth: 160, boxShadow: "0 4px 16px rgba(0,0,0,0.18)", overflow: "hidden",
                            }}>
                              <div style={{ padding: "5px 10px 4px", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--erp-text-3)", borderBottom: "1px solid var(--erp-border)" }}>Cambiar grupo</div>
                              {GRUPOS_PRODUCTO.filter(g => g !== "SERVICIO").map(g => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => handleCambiarGrupo(producto, g)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                                    padding: "8px 12px", border: "none", background: "transparent",
                                    fontSize: 12, fontWeight: 500, color: "var(--erp-text)", cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "var(--erp-bg)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                >
                                  <span style={{
                                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                    background: g === "PARA_LA_VENTA" ? "#16a34a" : "#ea580c",
                                  }} />
                                  {GRUPO_PRODUCTO_LABELS[g]}
                                  {(producto.grupo ?? "PARA_LA_VENTA") === g && <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--erp-text-3)" }}>✓ actual</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>}
                      <td className="prod-col-costo" style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{producto.costo.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      {grupoFiltro === "MATERIA_PRIMA" ? (
                        <>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {tasaHoy ? (producto.costo * tasaHoy).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{producto.stockActual}</td>
                          <td style={{ padding: "8px 12px", color: "var(--erp-text-2)" }}>{producto.unidadMedida ?? "—"}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{producto.precioVenta.toFixed(2)}</td>
                          <td className="prod-col-margen" style={{ padding: "8px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {(producto.precioVenta - producto.costo).toFixed(2)}
                          </td>
                          <td className="prod-col-extras" style={{ padding: "8px 12px", color: "var(--erp-text-2)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {producto.extras.length === 0
                              ? "-"
                              : producto.extras
                                  .map((extra) => `${extra.nombre} (+${extra.precioAdicional.toFixed(2)})`)
                                  .join(", ")}
                          </td>
                        </>
                      )}
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 4 }}>
                          {grupoFiltro !== "MATERIA_PRIMA" && (
                            <button
                              onClick={() => {
                                setExpandedId(expandedId === producto.id && expandedPanel === "extras" ? null : producto.id);
                                setExpandedPanel("extras");
                              }}
                              style={{ border: "1px solid var(--erp-border)", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 500, cursor: "pointer", background: "var(--erp-surface)", color: "var(--erp-text-2)" }}
                            >
                              Extras
                            </button>
                          )}
                          {producto.tipoProducto === "COMBO" && (
                            <button
                              onClick={() => {
                                setExpandedId(expandedId === producto.id && expandedPanel === "componentes" ? null : producto.id);
                                setExpandedPanel("componentes");
                              }}
                              style={{ border: "1px solid var(--erp-border)", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 500, cursor: "pointer", background: "var(--erp-surface)", color: "var(--erp-text-2)" }}
                            >
                              Componentes
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(producto)}
                            style={{ border: "1px solid var(--erp-border)", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 500, cursor: "pointer", background: "var(--erp-surface)", color: "var(--erp-text-2)" }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(producto.id)}
                            style={{ border: "1px solid #fecaca", borderRadius: 4, padding: "3px 8px", fontSize: 11, fontWeight: 500, cursor: "pointer", background: "var(--erp-surface)", color: "#dc2626" }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === producto.id && expandedPanel === "extras" && (
                      <tr>
                        <td colSpan={grupoFiltro === "MATERIA_PRIMA" ? 7 : 8} style={{ background: "var(--erp-bg)", padding: "12px 16px", borderBottom: "1px solid var(--erp-border)" }}>
                          <ProductoExtrasPanel producto={producto} onChange={loadProductos} />
                        </td>
                      </tr>
                    )}
                    {expandedId === producto.id && expandedPanel === "componentes" && (
                      <tr>
                        <td colSpan={grupoFiltro === "MATERIA_PRIMA" ? 7 : 8} style={{ background: "var(--erp-bg)", padding: "12px 16px", borderBottom: "1px solid var(--erp-border)" }}>
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
        </div>
        <Paginador
          total={productosOrdenados.length}
          pagina={pagina}
          porPagina={porPagina}
          opcionesPorPagina={[10, 15, 20, 50]}
          onPagina={setPagina}
          onPorPagina={setPorPagina}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { DESCUENTO_TIPOS, DESCUENTO_TIPO_LABELS, type Promocion, type DescuentoTipo, type Producto } from "@/lib/types";

const ICON_DESCUENTO: Record<DescuentoTipo, string> = {
  PORCENTAJE: "%",
  PRECIO_FIJO: "💲",
};

type FormState = {
  nombre: string;
  productoId: string;
  descuentoTipo: DescuentoTipo | "";
  valorPorcentaje: string;
  precioFijoUsd: string;
  tieneProductoGratis: boolean;
  productoGratisId: string;
  cantidadGratis: string;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

const EMPTY_FORM: FormState = {
  nombre: "",
  productoId: "",
  descuentoTipo: "",
  valorPorcentaje: "",
  precioFijoUsd: "",
  tieneProductoGratis: false,
  productoGratisId: "",
  cantidadGratis: "1",
  fechaInicio: today(),
  fechaFin: "",
  activa: true,
};

const errStyle = { borderColor: "#DC2626", background: "#FEF2F2" };

export default function PromocionesPanel({ productos }: { productos: Producto[] }) {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camposInvalidos, setCamposInvalidos] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/promociones");
      if (res.ok) setPromociones(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function nuevaPromocion() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setCamposInvalidos(new Set());
  }

  function seleccionar(p: Promocion) {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      productoId: String(p.productoId),
      descuentoTipo: p.descuentoTipo ?? "",
      valorPorcentaje: p.valorPorcentaje != null ? String(p.valorPorcentaje) : "",
      precioFijoUsd: p.precioFijoUsd != null ? String(p.precioFijoUsd) : "",
      tieneProductoGratis: p.tieneProductoGratis,
      productoGratisId: p.productoGratisId != null ? String(p.productoGratisId) : "",
      cantidadGratis: p.cantidadGratis != null ? String(p.cantidadGratis) : "1",
      fechaInicio: p.fechaInicio ?? "",
      fechaFin: p.fechaFin ?? "",
      activa: p.activa,
    });
    setError(null);
    setCamposInvalidos(new Set());
  }

  function validar(): Set<string> {
    const campos = new Set<string>();
    if (!form.nombre.trim()) campos.add("nombre");
    if (!form.productoId) campos.add("productoId");
    if (!form.fechaInicio) campos.add("fechaInicio");
    if (form.descuentoTipo === "PORCENTAJE" && !(Number(form.valorPorcentaje) > 0)) campos.add("valorPorcentaje");
    if (form.descuentoTipo === "PRECIO_FIJO" && !(Number(form.precioFijoUsd) > 0)) campos.add("precioFijoUsd");
    if (form.tieneProductoGratis && !form.productoGratisId) campos.add("productoGratisId");
    if (!form.descuentoTipo && !form.tieneProductoGratis) {
      campos.add("descuentoTipo");
      campos.add("tieneProductoGratis");
    }
    return campos;
  }

  async function handleGuardar() {
    setError(null);
    const invalidos = validar();
    setCamposInvalidos(invalidos);
    if (invalidos.size > 0) {
      setError("Completa los campos resaltados para guardar la promoción");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        productoId: Number(form.productoId),
        descuentoTipo: form.descuentoTipo || null,
        valorPorcentaje: form.descuentoTipo === "PORCENTAJE" ? Number(form.valorPorcentaje) : null,
        precioFijoUsd: form.descuentoTipo === "PRECIO_FIJO" ? Number(form.precioFijoUsd) : null,
        tieneProductoGratis: form.tieneProductoGratis,
        productoGratisId: form.tieneProductoGratis ? Number(form.productoGratisId) : null,
        cantidadGratis: form.tieneProductoGratis ? Number(form.cantidadGratis) || 1 : null,
        fechaInicio: form.fechaInicio,
        fechaFin: form.fechaFin || null,
        activa: form.activa,
      };
      const res = await fetch(editingId ? `/api/promociones/${editingId}` : "/api/promociones", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setCamposInvalidos(new Set(data.campos ?? []));
        throw new Error(data.error ?? "Error al guardar la promoción");
      }
      await load();
      if (!editingId) nuevaPromocion();
      else setEditingId(data.id ?? editingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la promoción");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePausa(p: Promocion) {
    await fetch(`/api/promociones/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !p.activa }),
    });
    await load();
    if (editingId === p.id) setForm((f) => ({ ...f, activa: !p.activa }));
  }

  async function handleEliminar(p: Promocion) {
    if (!confirm(`¿Eliminar la promoción "${p.nombre}" permanentemente?`)) return;
    await fetch(`/api/promociones/${p.id}`, { method: "DELETE" });
    if (editingId === p.id) nuevaPromocion();
    await load();
  }

  function resumenTipo(p: Promocion): string {
    const partes: string[] = [];
    if (p.descuentoTipo) partes.push(DESCUENTO_TIPO_LABELS[p.descuentoTipo]);
    if (p.tieneProductoGratis) partes.push("Producto gratis");
    return partes.join(" + ") || "Sin configurar";
  }

  function iconoPromo(p: Promocion): string {
    if (p.descuentoTipo && p.tieneProductoGratis) return "✨";
    if (p.descuentoTipo) return ICON_DESCUENTO[p.descuentoTipo];
    if (p.tieneProductoGratis) return "🎁";
    return "🏷️";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold" style={{ color: "var(--erp-text)" }}>Promociones</h2>
          <p className="text-xs" style={{ color: "var(--erp-text-2)" }}>Se aplican automáticamente al agregar el producto a una venta.</p>
        </div>
        <button
          type="button"
          onClick={nuevaPromocion}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--erp-accent)" }}
        >
          + Nueva Promoción
        </button>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:[grid-template-columns:320px_1fr]">
        {/* LIST */}
        <div className="rounded-xl border" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
          <div className="px-3 py-2.5 border-b text-xs font-bold" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>
            Todas ({promociones.length})
          </div>
          <ul className="flex flex-col gap-1 p-2 max-h-[600px] overflow-y-auto" style={{ listStyle: "none", margin: 0 }}>
            {loading && <li className="text-xs px-2 py-3" style={{ color: "var(--erp-text-3)" }}>Cargando…</li>}
            {!loading && promociones.length === 0 && (
              <li className="text-xs px-2 py-3" style={{ color: "var(--erp-text-3)" }}>Sin promociones aún.</li>
            )}
            {promociones.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => seleccionar(p)}
                  className="w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left"
                  style={{
                    background: editingId === p.id ? "var(--erp-primary-lt)" : "transparent",
                    border: editingId === p.id ? "1px solid var(--erp-border)" : "1px solid transparent",
                    opacity: p.activa ? 1 : 0.6,
                  }}
                >
                  <span className="w-8 h-8 rounded-md flex items-center justify-center text-sm flex-shrink-0" style={{ background: "var(--erp-primary-lt)", color: "var(--erp-primary)" }}>
                    {iconoPromo(p)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate" style={{ color: "var(--erp-text)" }}>{p.nombre}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--erp-text-3)" }}>{resumenTipo(p)} · {p.productoNombre}</span>
                  </span>
                  <span
                    className="text-[10px] font-extrabold uppercase rounded-full px-2 py-0.5 flex-shrink-0"
                    style={p.activa ? { background: "#E3F5E9", color: "#146C43" } : { background: "#F1EBE0", color: "#8A7457" }}
                  >
                    {p.activa ? "Activa" : "Pausada"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* DETAIL */}
        <div className="rounded-xl border" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--erp-border)" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
              {editingId ? "Editar promoción" : "Nueva promoción"}
            </h3>
            {editingId && (
              <label className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--erp-text-2)" }}>
                <input
                  type="checkbox"
                  checked={form.activa}
                  onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
                />
                Activa (desmarca para pausar)
              </label>
            )}
          </div>

          <div className="p-5 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Nombre de la promoción</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)", ...(camposInvalidos.has("nombre") ? errStyle : {}) }}
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: 2x1 Bolsas Medianas"
              />
              {camposInvalidos.has("nombre") && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Ingresa un nombre para la promoción</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Producto en promoción</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)", ...(camposInvalidos.has("productoId") ? errStyle : {}) }}
                value={form.productoId}
                onChange={(e) => setForm((f) => ({ ...f, productoId: e.target.value }))}
              >
                <option value="">— Seleccionar producto —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} (${p.precioVenta.toFixed(2)})</option>
                ))}
              </select>
              {camposInvalidos.has("productoId") && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Selecciona el producto en promoción</span>}
            </div>

            <div
              className="rounded-lg p-4 flex flex-col gap-3"
              style={{
                background: "var(--erp-bg)",
                border: camposInvalidos.has("descuentoTipo") ? "1px dashed #DC2626" : "1px dashed var(--erp-border)",
              }}
            >
              <div className="text-xs font-bold" style={{ color: "var(--erp-primary)" }}>Descuento (opcional)</div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, descuentoTipo: "" }))}
                  className="rounded-lg border px-3 py-2 text-xs font-bold"
                  style={{
                    borderColor: form.descuentoTipo === "" ? "var(--erp-primary)" : "var(--erp-border)",
                    background: form.descuentoTipo === "" ? "var(--erp-primary-lt)" : "var(--erp-surface)",
                    color: form.descuentoTipo === "" ? "var(--erp-primary)" : "var(--erp-text-2)",
                  }}
                >
                  Sin descuento
                </button>
                {DESCUENTO_TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, descuentoTipo: t }))}
                    className="rounded-lg border px-3 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                    style={{
                      borderColor: form.descuentoTipo === t ? "var(--erp-primary)" : "var(--erp-border)",
                      background: form.descuentoTipo === t ? "var(--erp-primary-lt)" : "var(--erp-surface)",
                      color: form.descuentoTipo === t ? "var(--erp-primary)" : "var(--erp-text-2)",
                    }}
                  >
                    <span>{ICON_DESCUENTO[t]}</span> {DESCUENTO_TIPO_LABELS[t]}
                  </button>
                ))}
              </div>

              {form.descuentoTipo === "PORCENTAJE" && (
                <div className="flex flex-col gap-1 max-w-[220px]">
                  <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Porcentaje de descuento</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max="100" step="1"
                      className="rounded-md border px-3 py-2 text-sm w-24"
                      style={{ borderColor: "var(--erp-border)", ...(camposInvalidos.has("valorPorcentaje") ? errStyle : {}) }}
                      value={form.valorPorcentaje}
                      onChange={(e) => setForm((f) => ({ ...f, valorPorcentaje: e.target.value }))}
                    />
                    <span className="text-sm font-bold" style={{ color: "var(--erp-text-2)" }}>%</span>
                  </div>
                  {camposInvalidos.has("valorPorcentaje") && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Indica el porcentaje de descuento</span>}
                </div>
              )}

              {form.descuentoTipo === "PRECIO_FIJO" && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Precio normal (referencia)</label>
                    <input
                      className="rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--erp-border)", opacity: 0.7 }}
                      value={form.productoId ? `$${productos.find((p) => String(p.id) === form.productoId)?.precioVenta.toFixed(2) ?? "0.00"}` : ""}
                      disabled
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Precio de venta con promoción ($)</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      className="rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--erp-border)", ...(camposInvalidos.has("precioFijoUsd") ? errStyle : {}) }}
                      value={form.precioFijoUsd}
                      onChange={(e) => setForm((f) => ({ ...f, precioFijoUsd: e.target.value }))}
                    />
                    {camposInvalidos.has("precioFijoUsd") && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Indica el precio de venta fijo</span>}
                  </div>
                </div>
              )}
            </div>

            <div
              className="rounded-lg p-4 flex flex-col gap-3"
              style={{
                background: "var(--erp-bg)",
                border: camposInvalidos.has("tieneProductoGratis") || camposInvalidos.has("productoGratisId") ? "1px dashed #DC2626" : "1px dashed var(--erp-border)",
              }}
            >
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: "var(--erp-primary)" }}>
                <input
                  type="checkbox"
                  checked={form.tieneProductoGratis}
                  onChange={(e) => setForm((f) => ({ ...f, tieneProductoGratis: e.target.checked }))}
                />
                🎁 Incluir producto adicional sin costo
              </label>
              {camposInvalidos.has("tieneProductoGratis") && (
                <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Elige al menos un descuento o un producto gratis</span>
              )}

              {form.tieneProductoGratis && (
                <div className="grid gap-3 grid-cols-1 sm:[grid-template-columns:1fr_140px]">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Producto adicional sin costo</label>
                    <select
                      className="rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--erp-border)", ...(camposInvalidos.has("productoGratisId") ? errStyle : {}) }}
                      value={form.productoGratisId}
                      onChange={(e) => setForm((f) => ({ ...f, productoGratisId: e.target.value }))}
                    >
                      <option value="">— Seleccionar producto —</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                    {camposInvalidos.has("productoGratisId") && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Selecciona el producto adicional sin costo</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Cantidad gratis</label>
                    <input
                      type="number" min="1" step="1"
                      className="rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--erp-border)" }}
                      value={form.cantidadGratis}
                      onChange={(e) => setForm((f) => ({ ...f, cantidadGratis: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Vigencia desde</label>
                <input
                  type="date"
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)", ...(camposInvalidos.has("fechaInicio") ? errStyle : {}) }}
                  value={form.fechaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                />
                {camposInvalidos.has("fechaInicio") && <span className="text-xs font-medium" style={{ color: "#DC2626" }}>Selecciona la fecha de inicio de vigencia</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Vigencia hasta (opcional)</label>
                <input
                  type="date"
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.fechaFin}
                  onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                />
              </div>
            </div>

            <div className="text-xs rounded-md px-3 py-2" style={{ background: "var(--erp-bg)", border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}>
              ⓘ El descuento y el producto gratis se pueden combinar en la misma promoción. Al pausarla deja de aplicarse en nuevas ventas de inmediato; reactivarla vuelve a aplicarla sola.
            </div>

            {error && (
              <div className="rounded-md border px-3 py-2 text-sm font-medium" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#DC2626" }}>⚠ {error}</div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleGuardar}
                disabled={saving}
                className="rounded-lg px-5 py-2.5 text-sm font-bold text-white"
                style={{ background: "var(--erp-primary)", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear promoción"}
              </button>
              {editingId && (
                <>
                  {(() => {
                    const actual = promociones.find((p) => p.id === editingId);
                    if (!actual) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => handleTogglePausa(actual)}
                        className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
                        style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
                      >
                        {actual.activa ? "Pausar" : "Reactivar"}
                      </button>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => {
                      const actual = promociones.find((p) => p.id === editingId);
                      if (actual) handleEliminar(actual);
                    }}
                    className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
                    style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
                  >
                    Eliminar
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={nuevaPromocion}
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

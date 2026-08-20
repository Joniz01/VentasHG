"use client";

import { useEffect, useState } from "react";
import { TIPOS_PROMOCION, TIPO_PROMOCION_LABELS, type Promocion, type TipoPromocion, type Producto } from "@/lib/types";

const ICONS: Record<TipoPromocion, string> = {
  DESCUENTO_PORCENTAJE: "%",
  PRECIO_FIJO: "💲",
  PRODUCTO_GRATIS: "🎁",
};

type FormState = {
  nombre: string;
  tipo: TipoPromocion;
  productoId: string;
  valorPorcentaje: string;
  precioFijoUsd: string;
  productoGratisId: string;
  cantidadGratis: string;
  fechaInicio: string;
  fechaFin: string;
  activa: boolean;
};

const EMPTY_FORM: FormState = {
  nombre: "",
  tipo: "DESCUENTO_PORCENTAJE",
  productoId: "",
  valorPorcentaje: "",
  precioFijoUsd: "",
  productoGratisId: "",
  cantidadGratis: "1",
  fechaInicio: "",
  fechaFin: "",
  activa: true,
};

export default function PromocionesPanel({ productos }: { productos: Producto[] }) {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }

  function seleccionar(p: Promocion) {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      productoId: String(p.productoId),
      valorPorcentaje: p.valorPorcentaje != null ? String(p.valorPorcentaje) : "",
      precioFijoUsd: p.precioFijoUsd != null ? String(p.precioFijoUsd) : "",
      productoGratisId: p.productoGratisId != null ? String(p.productoGratisId) : "",
      cantidadGratis: p.cantidadGratis != null ? String(p.cantidadGratis) : "1",
      fechaInicio: p.fechaInicio ?? "",
      fechaFin: p.fechaFin ?? "",
      activa: p.activa,
    });
    setError(null);
  }

  async function handleGuardar() {
    setError(null);
    if (!form.nombre.trim()) { setError("El nombre es obligatorio"); return; }
    if (!form.productoId) { setError("Selecciona el producto en promoción"); return; }
    if (form.tipo === "DESCUENTO_PORCENTAJE" && !(Number(form.valorPorcentaje) > 0)) { setError("Indica el porcentaje de descuento"); return; }
    if (form.tipo === "PRECIO_FIJO" && !(Number(form.precioFijoUsd) > 0)) { setError("Indica el precio de venta fijo"); return; }
    if (form.tipo === "PRODUCTO_GRATIS" && !form.productoGratisId) { setError("Selecciona el producto adicional sin costo"); return; }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        productoId: Number(form.productoId),
        valorPorcentaje: form.tipo === "DESCUENTO_PORCENTAJE" ? Number(form.valorPorcentaje) : null,
        precioFijoUsd: form.tipo === "PRECIO_FIJO" ? Number(form.precioFijoUsd) : null,
        productoGratisId: form.tipo === "PRODUCTO_GRATIS" ? Number(form.productoGratisId) : null,
        cantidadGratis: form.tipo === "PRODUCTO_GRATIS" ? Number(form.cantidadGratis) || 1 : null,
        fechaInicio: form.fechaInicio || null,
        fechaFin: form.fechaFin || null,
        activa: form.activa,
      };
      const res = await fetch(editingId ? `/api/promociones/${editingId}` : "/api/promociones", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar la promoción");
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
                    {ICONS[p.tipo]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate" style={{ color: "var(--erp-text)" }}>{p.nombre}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--erp-text-3)" }}>{TIPO_PROMOCION_LABELS[p.tipo]} · {p.productoNombre}</span>
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
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
                {editingId ? "Editar promoción" : "Nueva promoción"}
              </h3>
            </div>
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
                style={{ borderColor: "var(--erp-border)" }}
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: 2x1 Bolsas Medianas"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Tipo de promoción</label>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                {TIPOS_PROMOCION.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                    className="rounded-lg border px-3 py-2.5 text-left flex flex-col gap-1"
                    style={{
                      borderColor: form.tipo === t ? "var(--erp-primary)" : "var(--erp-border)",
                      background: form.tipo === t ? "var(--erp-primary-lt)" : "var(--erp-surface)",
                    }}
                  >
                    <span className="text-base">{ICONS[t]}</span>
                    <span className="text-xs font-bold" style={{ color: form.tipo === t ? "var(--erp-primary)" : "var(--erp-text-2)" }}>
                      {TIPO_PROMOCION_LABELS[t]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Producto en promoción</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.productoId}
                onChange={(e) => setForm((f) => ({ ...f, productoId: e.target.value }))}
              >
                <option value="">— Seleccionar producto —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} (${p.precioVenta.toFixed(2)})</option>
                ))}
              </select>
            </div>

            <div className="rounded-lg p-4 flex flex-col gap-3" style={{ background: "var(--erp-bg)", border: "1px dashed var(--erp-border)" }}>
              <div className="text-xs font-bold" style={{ color: "var(--erp-primary)" }}>
                Parámetros — {TIPO_PROMOCION_LABELS[form.tipo]}
              </div>

              {form.tipo === "DESCUENTO_PORCENTAJE" && (
                <div className="flex flex-col gap-1 max-w-[220px]">
                  <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Porcentaje de descuento</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min="1" max="100" step="1"
                      className="rounded-md border px-3 py-2 text-sm w-24"
                      style={{ borderColor: "var(--erp-border)" }}
                      value={form.valorPorcentaje}
                      onChange={(e) => setForm((f) => ({ ...f, valorPorcentaje: e.target.value }))}
                    />
                    <span className="text-sm font-bold" style={{ color: "var(--erp-text-2)" }}>%</span>
                  </div>
                </div>
              )}

              {form.tipo === "PRECIO_FIJO" && (
                <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
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
                      style={{ borderColor: "var(--erp-border)" }}
                      value={form.precioFijoUsd}
                      onChange={(e) => setForm((f) => ({ ...f, precioFijoUsd: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {form.tipo === "PRODUCTO_GRATIS" && (
                <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 140px" }}>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Producto adicional sin costo</label>
                    <select
                      className="rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--erp-border)" }}
                      value={form.productoGratisId}
                      onChange={(e) => setForm((f) => ({ ...f, productoGratisId: e.target.value }))}
                    >
                      <option value="">— Seleccionar producto —</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
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

            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase" style={{ color: "var(--erp-text-3)" }}>Vigencia desde</label>
                <input
                  type="date"
                  className="rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={form.fechaInicio}
                  onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                />
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
              ⓘ Al pausar una promoción deja de aplicarse en nuevas ventas de inmediato; las ventas ya registradas con ella no se modifican. Reactivarla vuelve a aplicarla sin necesidad de recrearla.
            </div>

            {error && (
              <div className="rounded-md border px-3 py-2 text-sm" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#DC2626" }}>{error}</div>
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

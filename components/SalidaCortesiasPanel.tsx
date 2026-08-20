"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Cliente, Producto } from "@/lib/types";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

const BASE_TIPOS = ["CORTESIA", "SORTEO", "CONSUMO_INTERNO", "EVENTO", "FIDELIDAD"];
const ICONS: Record<string, string> = { CORTESIA: "🤝", SORTEO: "🎯", CONSUMO_INTERNO: "🏠", EVENTO: "🎪", FIDELIDAD: "🎖️" };
const LABELS: Record<string, string> = { CORTESIA: "Cortesía", SORTEO: "Sorteo", CONSUMO_INTERNO: "Consumo interno", EVENTO: "Evento", FIDELIDAD: "Fidelidad" };
const BADGE: Record<string, { bg: string; color: string }> = {
  CORTESIA: { bg: "#EDE9FE", color: "#6D28D9" },
  SORTEO: { bg: "#DBEAFE", color: "#1D4ED8" },
  CONSUMO_INTERNO: { bg: "#FEF3C7", color: "#92400E" },
  EVENTO: { bg: "#FCE7F3", color: "#BE185D" },
  FIDELIDAD: { bg: "#D1FAE5", color: "#047857" },
};
function tipoLabel(t: string): string {
  return LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function tipoBadge(t: string) {
  return BADGE[t] ?? { bg: "var(--erp-bg)", color: "var(--erp-text-2)" };
}

type SalidaHistRow = {
  id: number;
  tipo: string;
  fecha: string;
  beneficiario: string | null;
  motivo: string | null;
  responsable: string | null;
  anulada: boolean;
  items: { productoId: number; nombre: string; cantidad: number; costoUnit: number }[];
};

function formatFecha(f: string): string {
  return f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4);
}

export default function SalidaCortesiasPanel({ productos }: { productos: Producto[] }) {
  const [tiposExtra, setTiposExtra] = useState<string[]>([]);
  const [tipo, setTipo] = useState<string>("CORTESIA");
  const [fecha, setFecha] = useState(today());
  const [beneficiario, setBeneficiario] = useState("");
  const [benefResultados, setBenefResultados] = useState<Cliente[]>([]);
  const [benefMostrar, setBenefMostrar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [items, setItems] = useState<{ productoId: string; cantidad: string }[]>([{ productoId: "", cantidad: "1" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [historial, setHistorial] = useState<SalidaHistRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [anulando, setAnulando] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((cfg: Record<string, string>) => {
        if (cfg.salidas_tipos_extra) {
          setTiposExtra(cfg.salidas_tipos_extra.split(",").map((s) => s.trim()).filter(Boolean));
        }
      })
      .catch(() => {});
    loadHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistorial() {
    setHistLoading(true);
    try {
      const res = await fetch("/api/salidas-gratuitas");
      if (res.ok) setHistorial(await res.json());
    } finally {
      setHistLoading(false);
    }
  }

  async function buscarBenef(query: string) {
    if (query.trim().length < 3) { setBenefResultados([]); return; }
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as Cliente[];
      setBenefResultados(data);
      setBenefMostrar(true);
    } catch {
      setBenefResultados([]);
    }
  }

  function limpiarForm() {
    setEditingId(null);
    setItems([{ productoId: "", cantidad: "1" }]);
    setBeneficiario("");
    setMotivo("");
    setTipo("CORTESIA");
    setFecha(today());
    setError(null);
    setSuccess(false);
  }

  function startEdit(s: SalidaHistRow) {
    setEditingId(s.id);
    setTipo(s.tipo);
    setFecha(s.fecha.slice(0, 10));
    setBeneficiario(s.beneficiario ?? "");
    setMotivo(s.motivo ?? "");
    setItems(s.items.map((it) => ({ productoId: String(it.productoId), cantidad: String(it.cantidad) })));
    setError(null);
    setSuccess(false);
  }

  async function handleAnular(id: number) {
    if (!confirm("¿Anular esta salida? Se restaurará el stock de los productos.")) return;
    setAnulando(id);
    try {
      await fetch(`/api/salidas-gratuitas/${id}/anular`, { method: "POST" });
      await loadHistorial();
    } finally {
      setAnulando(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const itemsValidos = items.filter((i) => i.productoId && Number(i.cantidad) > 0);
    if (!itemsValidos.length) {
      setError("Agrega al menos un producto con cantidad válida.");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/salidas-gratuitas/${editingId}` : "/api/salidas-gratuitas";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, fecha, beneficiario: beneficiario.trim() || null, motivo: motivo.trim() || null, items: itemsValidos }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al registrar la salida.");
      } else {
        setSuccess(true);
        limpiarForm();
        await loadHistorial();
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const allTipos = [...BASE_TIPOS, ...tiposExtra.filter((x) => !BASE_TIPOS.includes(x))];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {editingId && (
        <div className="flex items-center gap-2 rounded-md border p-2" style={{ background: "#FFFBEB", borderColor: "#F59E0B" }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#92400E" }}>Editando salida #{editingId} — los cambios actualizarán el stock automáticamente.</span>
          <button type="button" onClick={limpiarForm} style={{ fontSize: 11, color: "#92400E", background: "transparent", border: "1px solid #F59E0B", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}>
            Cancelar edición
          </button>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold uppercase" style={{ color: "var(--erp-text-3)" }}>Tipo de salida</label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {allTipos.map((t) => {
            const sel = tipo === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className="flex flex-col items-center gap-1 rounded-lg border px-4 py-2.5 text-xs font-semibold min-w-[92px]"
                style={{
                  borderColor: sel ? "var(--erp-primary)" : "var(--erp-border)",
                  background: sel ? "var(--erp-primary-lt)" : "var(--erp-surface)",
                  color: sel ? "var(--erp-primary)" : "var(--erp-text-2)",
                }}
              >
                <span style={{ fontSize: 18 }}>{ICONS[t] ?? "🏷️"}</span>
                {tipoLabel(t)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase" style={{ color: "var(--erp-text-3)" }}>Fecha</label>
          <input
            type="date"
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1" style={{ position: "relative" }}>
          <label className="text-xs font-semibold uppercase" style={{ color: "var(--erp-text-3)" }}>Beneficiario / Destinatario</label>
          <input
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={beneficiario}
            onChange={(e) => { setBeneficiario(e.target.value); buscarBenef(e.target.value); }}
            onFocus={() => benefResultados.length > 0 && setBenefMostrar(true)}
            onBlur={() => setTimeout(() => setBenefMostrar(false), 150)}
            placeholder="Nombre"
          />
          {benefMostrar && benefResultados.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 z-10 rounded-md border bg-white shadow-md max-h-48 overflow-y-auto"
              style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}
            >
              {benefResultados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => { setBeneficiario(c.nombre); setBenefMostrar(false); }}
                  className="block w-full text-left px-3 py-2 text-sm"
                  style={{ borderBottom: "1px solid var(--erp-border)" }}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase" style={{ color: "var(--erp-text-3)" }}>Productos a entregar</label>
        <div className="flex flex-col gap-2 mt-1.5">
          {items.map((item, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <select
                className="rounded-md border px-3 py-2 text-sm flex-1"
                style={{ borderColor: "var(--erp-border)" }}
                value={item.productoId}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], productoId: e.target.value };
                  setItems(next);
                }}
              >
                <option value="">— Seleccionar producto —</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="rounded-md border px-3 py-2 text-sm w-24"
                style={{ borderColor: "var(--erp-border)" }}
                value={item.cantidad}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...next[idx], cantidad: e.target.value };
                  setItems(next);
                }}
              />
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                disabled={items.length === 1}
                className="rounded-md border w-8 h-8 flex items-center justify-center"
                style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-3)", opacity: items.length === 1 ? 0.3 : 1 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems([...items, { productoId: "", cantidad: "1" }])}
          className="mt-2 text-xs font-semibold rounded-md border-dashed border py-1.5 w-full text-center"
          style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}
        >
          + Agregar producto
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase" style={{ color: "var(--erp-text-3)" }}>Motivo / Descripción</label>
        <textarea
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--erp-border)" }}
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: Cortesía por fidelidad — cliente lleva 1 año con nosotros"
        />
      </div>

      <div className="rounded-md border p-3 text-xs" style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>
        ⓘ Esta salida descuenta el inventario pero no genera ingreso ni cobro. Quedará registrada en el historial de salidas con el tipo seleccionado.
      </div>

      {error && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ background: "#FEE2E2", borderColor: "#FCA5A5", color: "#DC2626" }}>{error}</div>
      )}
      {success && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ background: "#DCFCE7", borderColor: "#86EFAC", color: "#166534" }}>✓ Salida registrada correctamente.</div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-md px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--erp-primary)", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Guardando…" : editingId ? "✓ Guardar cambios" : "✓ Registrar Salida Gratuita"}
        </button>
        <button
          type="button"
          onClick={limpiarForm}
          className="rounded-md border px-4 py-2.5 text-sm font-semibold"
          style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
        >
          Limpiar
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>Historial de salidas registradas</span>
        {histLoading ? (
          <div className="text-sm" style={{ color: "var(--erp-text-3)" }}>Cargando…</div>
        ) : historial.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--erp-text-3)" }}>No hay salidas registradas aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--erp-border)" }}>
                  <th className="text-left px-2 py-1.5" style={{ color: "var(--erp-text-3)" }}>Fecha</th>
                  <th className="text-left px-2 py-1.5" style={{ color: "var(--erp-text-3)" }}>Tipo</th>
                  <th className="text-left px-2 py-1.5" style={{ color: "var(--erp-text-3)" }}>Beneficiario</th>
                  <th className="text-left px-2 py-1.5" style={{ color: "var(--erp-text-3)" }}>Productos</th>
                  <th className="text-left px-2 py-1.5" style={{ color: "var(--erp-text-3)" }}>Responsable</th>
                  <th className="text-center px-2 py-1.5" style={{ color: "var(--erp-text-3)" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((s) => {
                  const badge = tipoBadge(s.tipo);
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--erp-border)", opacity: s.anulada ? 0.5 : 1 }}>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatFecha(s.fecha)}</td>
                      <td className="px-2 py-1.5">
                        <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                          {tipoLabel(s.tipo)}
                        </span>
                        {s.anulada && <span className="ml-1 text-xs font-bold" style={{ color: "#DC2626" }}>ANULADA</span>}
                      </td>
                      <td className="px-2 py-1.5">{s.beneficiario || "—"}</td>
                      <td className="px-2 py-1.5">{s.items.map((it) => `${it.nombre} (${it.cantidad})`).join(", ")}</td>
                      <td className="px-2 py-1.5">{s.responsable || "—"}</td>
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        {!s.anulada && (
                          <div className="flex gap-1 justify-center">
                            <button type="button" onClick={() => startEdit(s)} className="text-xs font-semibold px-2 py-1 rounded-md border" style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}>
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAnular(s.id)}
                              disabled={anulando === s.id}
                              className="text-xs font-semibold px-2 py-1 rounded-md border"
                              style={{ background: "#FEE2E2", color: "#DC2626", borderColor: "#FCA5A5", opacity: anulando === s.id ? 0.6 : 1 }}
                            >
                              {anulando === s.id ? "…" : "Anular"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </form>
  );
}

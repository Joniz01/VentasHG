"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Cliente, EmpaqueProducto, Producto } from "@/lib/types";

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

type ItemForm = {
  productoId: string;
  cantidad: string;
  empaqueRelId?: number;
  variadaSelecciones?: string[]; // solo para productos VARIADA
};

type ModalEmpaque = {
  itemIdx: number;
  racionIndex?: number; // presente cuando es una ración de Bandeja Variada
  productoId: string;
  productoNombre: string;
  empaques: EmpaqueProducto[];
  seleccionado: number;
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
  const [items, setItems] = useState<ItemForm[]>([{ productoId: "", cantidad: "1" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [historial, setHistorial] = useState<SalidaHistRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [anulando, setAnulando] = useState<number | null>(null);

  const [modalEmpaque, setModalEmpaque] = useState<ModalEmpaque | null>(null);

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

  function handleProductoChange(idx: number, productoId: string) {
    const prod = productoId ? productos.find((p) => String(p.id) === productoId) : null;
    const next = [...items];
    next[idx] = {
      productoId,
      cantidad: next[idx].cantidad,
      empaqueRelId: undefined,
      variadaSelecciones: prod?.tipoProducto === "VARIADA"
        ? Array.from({ length: prod.variadaRaciones }, () => "")
        : undefined,
    };
    setItems(next);

    if (!prod) return;

    if (prod.tipoProducto !== "VARIADA" && prod.stockActual <= 0 && prod.empaques && prod.empaques.length > 0) {
      const empaquesConStock = prod.empaques.filter((e) => e.empaqueStock > 0);
      if (empaquesConStock.length > 0) {
        setModalEmpaque({
          itemIdx: idx,
          productoId,
          productoNombre: prod.nombre,
          empaques: empaquesConStock,
          seleccionado: empaquesConStock[0].id,
        });
      }
    }
  }

  function handleRacionChange(itemIdx: number, racionIndex: number, productoId: string) {
    const prod = productoId ? productos.find((p) => String(p.id) === productoId) : null;
    if (prod && prod.stockActual <= 0 && prod.empaques?.length) {
      const conStock = prod.empaques.filter((e) => e.empaqueStock > 0);
      if (conStock.length > 0) {
        setModalEmpaque({
          itemIdx,
          racionIndex,
          productoId,
          productoNombre: prod.nombre,
          empaques: conStock,
          seleccionado: conStock[0].id,
        });
        return;
      }
    }
    const next = [...items];
    const s = [...(next[itemIdx].variadaSelecciones ?? [])];
    s[racionIndex] = productoId;
    next[itemIdx] = { ...next[itemIdx], variadaSelecciones: s };
    setItems(next);
  }

  function confirmarEmpaque() {
    if (!modalEmpaque) return;
    const next = [...items];
    if (typeof modalEmpaque.racionIndex === "number") {
      // Es una ración: marcar la selección con empaqueRelId en el item padre (no se puede por ítem de ración, se guarda en array)
      const s = [...(next[modalEmpaque.itemIdx].variadaSelecciones ?? [])];
      s[modalEmpaque.racionIndex] = modalEmpaque.productoId;
      next[modalEmpaque.itemIdx] = {
        ...next[modalEmpaque.itemIdx],
        variadaSelecciones: s,
        // guardar empaque de ración como campo auxiliar para el submit
        empaqueRelId: modalEmpaque.seleccionado,
      };
    } else {
      next[modalEmpaque.itemIdx] = {
        ...next[modalEmpaque.itemIdx],
        empaqueRelId: modalEmpaque.seleccionado,
      };
    }
    setItems(next);
    setModalEmpaque(null);
  }

  function cancelarEmpaque() {
    if (!modalEmpaque) return;
    const next = [...items];
    if (typeof modalEmpaque.racionIndex === "number") {
      const s = [...(next[modalEmpaque.itemIdx].variadaSelecciones ?? [])];
      s[modalEmpaque.racionIndex] = "";
      next[modalEmpaque.itemIdx] = { ...next[modalEmpaque.itemIdx], variadaSelecciones: s };
    } else {
      next[modalEmpaque.itemIdx] = { productoId: "", cantidad: next[modalEmpaque.itemIdx].cantidad };
    }
    setItems(next);
    setModalEmpaque(null);
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
    for (const it of itemsValidos) {
      const prod = productos.find((p) => String(p.id) === it.productoId);
      if (prod?.tipoProducto === "VARIADA") {
        const seleccionadas = (it.variadaSelecciones ?? []).filter(Boolean);
        if (seleccionadas.length !== prod.variadaRaciones) {
          setError(`Selecciona las ${prod.variadaRaciones} raciones de "${prod.nombre}"`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/salidas-gratuitas/${editingId}` : "/api/salidas-gratuitas";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          fecha,
          beneficiario: beneficiario.trim() || null,
          motivo: motivo.trim() || null,
          items: itemsValidos.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            empaqueRelId: i.empaqueRelId ?? null,
            variadaSelecciones: i.variadaSelecciones?.filter(Boolean) ?? [],
          })),
        }),
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
    <>
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
            {items.map((item, idx) => {
              const prod = item.productoId ? productos.find((p) => String(p.id) === item.productoId) : null;
              const usaEmpaque = !!item.empaqueRelId;
              return (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex flex-col flex-1 gap-0.5">
                    <select
                      className="rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: usaEmpaque ? "#F59E0B" : "var(--erp-border)" }}
                      value={item.productoId}
                      onChange={(e) => handleProductoChange(idx, e.target.value)}
                    >
                      <option value="">— Seleccionar producto —</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}{p.stockActual <= 0 && p.empaques?.some((e) => e.empaqueStock > 0) ? " 📦" : ""}
                        </option>
                      ))}
                    </select>
                    {usaEmpaque && !item.variadaSelecciones && prod && (
                      <span className="text-xs" style={{ color: "#92400E" }}>
                        📦 Se abrirá empaque al guardar
                      </span>
                    )}
                    {prod?.tipoProducto === "VARIADA" && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>Raciones:</span>
                        {(item.variadaSelecciones ?? []).map((sel, rIdx) => (
                          <select
                            key={rIdx}
                            className="rounded-md border px-2 py-1 text-xs"
                            style={{ borderColor: sel ? "var(--erp-border)" : "#FCA5A5" }}
                            value={sel}
                            onChange={(e) => handleRacionChange(idx, rIdx, e.target.value)}
                          >
                            <option value="">Ración {rIdx + 1}</option>
                            {productos.filter((p) => p.tipoProducto === "NORMAL").map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} (stock: {p.stockActual}){p.stockActual <= 0 && p.empaques?.some(e => e.empaqueStock > 0) ? " 📦" : ""}
                              </option>
                            ))}
                          </select>
                        ))}
                      </div>
                    )}
                  </div>
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
              );
            })}
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

      {/* ── Modal apertura de empaque ── */}
      {modalEmpaque && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, maxWidth: 440, width: "100%", overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--erp-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📦</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)" }}>Sin stock — empaque disponible</div>
                <div style={{ fontSize: 12, color: "var(--erp-text-2)" }}>¿Abrir un empaque para continuar la salida?</div>
              </div>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ background: "#FEE2E2", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
                <strong style={{ color: "#DC2626" }}>{modalEmpaque.productoNombre}</strong>
                <span style={{ color: "#991B1B", marginLeft: 8 }}>Sin stock disponible</span>
              </div>

              {modalEmpaque.empaques.length === 1 ? (
                <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "10px 12px", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#92400E" }}>📦 {modalEmpaque.empaques[0].empaqueNombre}</div>
                  <div style={{ color: "#78350F", marginTop: 2 }}>Stock: {modalEmpaque.empaques[0].empaqueStock} · Rinde {modalEmpaque.empaques[0].rendimiento} unidades al abrir</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {modalEmpaque.empaques.map((emp) => (
                    <label key={emp.id} style={{ display: "flex", gap: 10, alignItems: "center", background: modalEmpaque.seleccionado === emp.id ? "#DBEAFE" : "var(--erp-bg)", border: `2px solid ${modalEmpaque.seleccionado === emp.id ? "var(--erp-primary)" : "var(--erp-border)"}`, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontSize: 13 }}>
                      <input
                        type="radio"
                        name="empaque-sel-cortesia"
                        checked={modalEmpaque.seleccionado === emp.id}
                        onChange={() => setModalEmpaque((prev) => prev ? { ...prev, seleccionado: emp.id } : null)}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--erp-text)" }}>{emp.empaqueNombre} <span style={{ fontWeight: 400, color: "var(--erp-text-3)" }}>({emp.prioridad === 1 ? "Principal" : "Alternativo"})</span></div>
                        <div style={{ color: "var(--erp-text-2)", fontSize: 12 }}>Stock: {emp.empaqueStock} · Rinde {emp.rendimiento} unidades</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {(() => {
                const sel = modalEmpaque.empaques.find((e) => e.id === modalEmpaque.seleccionado);
                if (!sel) return null;
                return (
                  <div style={{ marginTop: 10, background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 6, padding: "10px 12px", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: "#15803D", marginBottom: 4 }}>✓ Resultado si confirma</div>
                    <div style={{ color: "#166534", display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>📦 {sel.empaqueNombre}: −1 (quedan {sel.empaqueStock - 1})</span>
                      <span>➕ {sel.rendimiento} unidades generadas</span>
                      <span>🤝 −1 unidad entregada como salida</span>
                      <span style={{ borderTop: "1px solid #86EFAC", paddingTop: 4, marginTop: 2, fontWeight: 700 }}>✓ Quedan {sel.rendimiento - 1} en inventario</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--erp-border)", display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={cancelarEmpaque}
                style={{ background: "transparent", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "8px 16px", fontSize: 13, color: "var(--erp-text-2)", cursor: "pointer" }}
              >Cancelar</button>
              <button
                type="button"
                onClick={confirmarEmpaque}
                disabled={!modalEmpaque.seleccionado}
                style={{ flex: 1, background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >✓ Confirmar y registrar salida</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

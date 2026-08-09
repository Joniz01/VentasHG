"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ESTADOS_GASTO,
  ESTADO_GASTO_LABELS,
  FRECUENCIAS_RECURRENCIA,
  FRECUENCIA_RECURRENCIA_LABELS,
  TIPOS_GASTO,
  type EstadoGasto,
  type FrecuenciaRecurrencia,
  type Gasto,
  type GastoResumen,
  type Locacion,
  type TipoGasto,
  type TipoGastoCatalogo,
} from "@/lib/types";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

const PAGE_SIZES = [5, 10, 20, 25];

type FormState = {
  tipoGastoId: string;
  tipo: TipoGasto;
  proveedor: string;
  descripcion: string;
  locacionId: string;
  fecha: string;
  montoBs: string;
  tasaDia: string;
  estado: EstadoGasto;
  recurrente: boolean;
  frecuencia: FrecuenciaRecurrencia;
};

const EMPTY_FORM: FormState = {
  tipoGastoId: "",
  tipo: "OCASIONAL",
  proveedor: "",
  descripcion: "",
  locacionId: "",
  fecha: today(),
  montoBs: "",
  tasaDia: "",
  estado: "PENDIENTE",
  recurrente: false,
  frecuencia: "MENSUAL",
};

function formatFechaCorta(fecha: string): string {
  return fecha.slice(8, 10) + "/" + fecha.slice(5, 7) + "/" + fecha.slice(0, 4);
}

const ESTADO_COLORES: Record<EstadoGasto, string> = {
  PENDIENTE: "#a16207",
  APROBADO: "#1d4ed8",
  PAGADO: "#15803d",
};

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border px-4 py-3 flex-1 min-w-[160px]" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
      <div className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>{label}</div>
      <div className="text-xl font-extrabold" style={{ color }}>${value.toFixed(2)}</div>
    </div>
  );
}

export default function GastosClient() {
  const [items, setItems] = useState<Gasto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [filtroTipoGastoId, setFiltroTipoGastoId] = useState("");

  const [tiposGasto, setTiposGasto] = useState<TipoGastoCatalogo[]>([]);
  const [locaciones, setLocaciones] = useState<Locacion[]>([]);
  const [resumen, setResumen] = useState<GastoResumen>({ gastoHoy: 0, gastoMes: 0, pendientePorPagar: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [nuevaLocacion, setNuevaLocacion] = useState("");

  const [recordatorios, setRecordatorios] = useState<
    { id: number; proveedor: string; tipoGastoNombre: string; montoBs: number; proximoRecordatorio: string }[]
  >([]);

  async function loadGastos() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filtroDesde) params.set("desde", filtroDesde);
      if (filtroHasta) params.set("hasta", filtroHasta);
      if (filtroProveedor) params.set("proveedor", filtroProveedor);
      if (filtroTipoGastoId) params.set("tipoGastoId", filtroTipoGastoId);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/gastos?${params.toString()}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("No se pudieron cargar los gastos");
    } finally {
      setLoading(false);
    }
  }

  async function loadTiposGasto() {
    const res = await fetch("/api/tipos-gasto");
    if (res.ok) setTiposGasto(await res.json());
  }

  async function loadLocaciones() {
    const res = await fetch("/api/locaciones");
    if (res.ok) setLocaciones(await res.json());
  }

  async function loadResumen() {
    const res = await fetch("/api/gastos/resumen");
    if (res.ok) setResumen(await res.json());
  }

  async function loadRecordatorios() {
    try {
      const res = await fetch("/api/gastos/recordatorios");
      const data = await res.json();
      setRecordatorios(data.items ?? []);
    } catch {
      setRecordatorios([]);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTiposGasto();
    loadLocaciones();
    loadResumen();
    loadRecordatorios();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGastos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filtroDesde, filtroHasta, filtroProveedor, filtroTipoGastoId]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(false);
  }

  function startEdit(g: Gasto) {
    setEditingId(g.id);
    setForm({
      tipoGastoId: String(g.tipoGastoId),
      tipo: g.tipo,
      proveedor: g.proveedor,
      descripcion: g.descripcion ?? "",
      locacionId: g.locacionId ? String(g.locacionId) : "",
      fecha: g.fecha,
      montoBs: String(g.montoBs),
      tasaDia: String(g.tasaDia),
      estado: g.estado,
      recurrente: g.recurrente,
      frecuencia: g.frecuencia ?? "MENSUAL",
    });
    setShowForm(true);
  }

  async function handleAgregarLocacion() {
    const nombre = nuevaLocacion.trim();
    if (!nombre) return;
    const res = await fetch("/api/locaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (res.ok) {
      const loc = await res.json();
      setLocaciones((prev) => [...prev, loc].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setForm((p) => ({ ...p, locacionId: String(loc.id) }));
      setNuevaLocacion("");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.tipoGastoId) {
      setError("Selecciona el tipo de gasto");
      return;
    }
    if (!form.proveedor.trim()) {
      setError("Indica el proveedor / gasto");
      return;
    }
    if (form.recurrente && !form.frecuencia) {
      setError("Indica la frecuencia de recurrencia");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        tipoGastoId: Number(form.tipoGastoId),
        tipo: form.tipo,
        proveedor: form.proveedor.trim(),
        descripcion: form.descripcion.trim(),
        locacionId: form.locacionId ? Number(form.locacionId) : null,
        fecha: form.fecha,
        montoBs: Number(form.montoBs) || 0,
        tasaDia: Number(form.tasaDia) || 0,
        estado: form.estado,
        recurrente: form.recurrente,
        frecuencia: form.recurrente ? form.frecuencia : null,
      };

      const res = await fetch(editingId ? `/api/gastos/${editingId}` : "/api/gastos", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar el gasto");

      resetForm();
      await loadGastos();
      await loadResumen();
      await loadRecordatorios();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el gasto");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: number) {
    if (!confirm("¿Eliminar este gasto?")) return;
    const res = await fetch(`/api/gastos/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadGastos();
      await loadResumen();
    }
  }

  async function handleCambiarEstado(g: Gasto, estado: EstadoGasto) {
    await fetch(`/api/gastos/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoGastoId: g.tipoGastoId,
        tipo: g.tipo,
        proveedor: g.proveedor,
        descripcion: g.descripcion,
        locacionId: g.locacionId,
        fecha: g.fecha,
        montoBs: g.montoBs,
        tasaDia: g.tasaDia,
        estado,
        recurrente: g.recurrente,
        frecuencia: g.frecuencia,
      }),
    });
    await loadGastos();
    await loadResumen();
  }

  async function handleDescartarRecordatorio(id: number) {
    const g = items.find((x) => x.id === id);
    if (!g) {
      await loadRecordatorios();
      return;
    }
    await fetch(`/api/gastos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoGastoId: g.tipoGastoId,
        tipo: g.tipo,
        proveedor: g.proveedor,
        descripcion: g.descripcion,
        locacionId: g.locacionId,
        fecha: g.fecha,
        montoBs: g.montoBs,
        tasaDia: g.tasaDia,
        estado: g.estado,
        recurrente: g.recurrente,
        frecuencia: g.frecuencia,
        recordatorioVisto: true,
      }),
    });
    await loadRecordatorios();
  }

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-4">
      {recordatorios.length > 0 && (
        <div
          className="rounded-lg border p-3 flex flex-col gap-2"
          style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>
            🔔 Recordatorio de gastos recurrentes
          </span>
          {recordatorios.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--erp-text-2)" }}>
              <span>
                <strong>{r.proveedor}</strong> ({r.tipoGastoNombre}) — vence {formatFechaCorta(r.proximoRecordatorio)}
              </span>
              <button
                type="button"
                onClick={() => handleDescartarRecordatorio(r.id)}
                className="rounded-md border px-2 py-1 text-xs font-medium"
                style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
              >
                Descartar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <StatTile label="Gasto Hoy" value={resumen.gastoHoy} color="var(--erp-text)" />
        <StatTile label="Gasto del Mes" value={resumen.gastoMes} color="var(--erp-text)" />
        <StatTile label="Pendiente por Pagar" value={resumen.pendientePorPagar} color="#a16207" />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setForm({ ...EMPTY_FORM });
            setEditingId(null);
            setShowForm((v) => !v);
          }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--erp-accent)" }}
        >
          {showForm ? "Cancelar" : "+ Registrar Gasto"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Tipo de gasto</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.tipoGastoId}
                onChange={(e) => setForm((p) => ({ ...p, tipoGastoId: e.target.value }))}
                required
              >
                <option value="">Selecciona…</option>
                {tiposGasto.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Fijo / Ocasional</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoGasto }))}
              >
                {TIPOS_GASTO.map((t) => (
                  <option key={t} value={t}>{t === "FIJO" ? "Fijo" : "Ocasional"}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Estado</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.estado}
                onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value as EstadoGasto }))}
              >
                {ESTADOS_GASTO.map((s) => (
                  <option key={s} value={s}>{ESTADO_GASTO_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Gasto / Proveedor</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.proveedor}
                onChange={(e) => setForm((p) => ({ ...p, proveedor: e.target.value }))}
                placeholder="Ej: Simple Fibra"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Descripción</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Servicio de Internet"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Locación</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.locacionId}
                onChange={(e) => setForm((p) => ({ ...p, locacionId: e.target.value }))}
              >
                <option value="">—</option>
                {locaciones.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
              <div className="flex gap-1 mt-1">
                <input
                  className="rounded-md border px-2 py-1 text-xs flex-1"
                  style={{ borderColor: "var(--erp-border)" }}
                  value={nuevaLocacion}
                  onChange={(e) => setNuevaLocacion(e.target.value)}
                  placeholder="Nueva locación"
                />
                <button type="button" onClick={handleAgregarLocacion} className="text-xs px-2 rounded-md border" style={{ borderColor: "var(--erp-border)" }}>
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Fecha</label>
              <input
                type="date"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Monto Bs</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.montoBs}
                onChange={(e) => setForm((p) => ({ ...p, montoBs: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Tasa del día</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.tasaDia}
                onChange={(e) => setForm((p) => ({ ...p, tasaDia: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--erp-text)" }}>
              <input
                type="checkbox"
                checked={form.recurrente}
                onChange={(e) => setForm((p) => ({ ...p, recurrente: e.target.checked }))}
              />
              Gasto recurrente (recordatorio automático)
            </label>
            {form.recurrente && (
              <select
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.frecuencia}
                onChange={(e) => setForm((p) => ({ ...p, frecuencia: e.target.value as FrecuenciaRecurrencia }))}
              >
                {FRECUENCIAS_RECURRENCIA.map((f) => (
                  <option key={f} value={f}>{FRECUENCIA_RECURRENCIA_LABELS[f]}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--erp-primary)" }}
            >
              {saving ? "Guardando..." : editingId ? "Actualizar Gasto" : "Guardar Gasto"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border p-3 flex flex-wrap gap-3 items-end" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Desde</label>
          <input
            type="date"
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroDesde}
            onChange={(e) => { setFiltroDesde(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Hasta</label>
          <input
            type="date"
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroHasta}
            onChange={(e) => { setFiltroHasta(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Proveedor</label>
          <input
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroProveedor}
            onChange={(e) => { setFiltroProveedor(e.target.value); setPage(1); }}
            placeholder="Buscar proveedor…"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Tipo de gasto</label>
          <select
            className="rounded-md border px-2 py-1.5 text-sm"
            style={{ borderColor: "var(--erp-border)" }}
            value={filtroTipoGastoId}
            onChange={(e) => { setFiltroTipoGastoId(e.target.value); setPage(1); }}
          >
            <option value="">Todos</option>
            {tiposGasto.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        {(filtroDesde || filtroHasta || filtroProveedor || filtroTipoGastoId) && (
          <button
            type="button"
            onClick={() => { setFiltroDesde(""); setFiltroHasta(""); setFiltroProveedor(""); setFiltroTipoGastoId(""); setPage(1); }}
            className="text-xs px-3 py-1.5 rounded-md border"
            style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)", color: "var(--erp-text)" }}
        >
          Sin gastos registrados.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "var(--erp-text-2)" }}>
                  <th className="text-left px-3 py-2">Fecha</th>
                  <th className="text-left px-3 py-2">Tipo de gasto</th>
                  <th className="text-left px-3 py-2">Gasto/Proveedor</th>
                  <th className="text-left px-3 py-2">Tipo</th>
                  <th className="text-left px-3 py-2">Descripción</th>
                  <th className="text-left px-3 py-2">Locación</th>
                  <th className="text-right px-3 py-2">Monto Bs</th>
                  <th className="text-right px-3 py-2">Monto $</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                    <td className="px-3 py-2">{formatFechaCorta(g.fecha)}</td>
                    <td className="px-3 py-2">{g.tipoGastoNombre}</td>
                    <td className="px-3 py-2" style={{ color: "var(--erp-text)" }}>
                      {g.proveedor} {g.recurrente && <span title="Recurrente">🔁</span>}
                    </td>
                    <td className="px-3 py-2">{g.tipo === "FIJO" ? "Fijo" : "Ocasional"}</td>
                    <td className="px-3 py-2">{g.descripcion}</td>
                    <td className="px-3 py-2">{g.locacionNombre ?? "—"}</td>
                    <td className="px-3 py-2 text-right">Bs{g.montoBs.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">${g.montoUsd.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <select
                        value={g.estado}
                        onChange={(e) => handleCambiarEstado(g, e.target.value as EstadoGasto)}
                        className="rounded-md border px-2 py-1 text-xs font-semibold"
                        style={{ borderColor: "var(--erp-border)", color: ESTADO_COLORES[g.estado] }}
                      >
                        {ESTADOS_GASTO.map((s) => (
                          <option key={s} value={s}>{ESTADO_GASTO_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(g)} className="text-xs" style={{ color: "var(--erp-primary)" }}>
                          Editar
                        </button>
                        <button type="button" onClick={() => handleEliminar(g.id)} className="text-xs text-red-600">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap px-3 py-2 border-t text-xs" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="rounded-md border px-2 py-1"
                style={{ borderColor: "var(--erp-border)" }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span>de {total} gastos</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-2 py-1 disabled:opacity-40" style={{ borderColor: "var(--erp-border)" }}>
                ←
              </button>
              <span>Página {page} de {totalPaginas}</span>
              <button type="button" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-2 py-1 disabled:opacity-40" style={{ borderColor: "var(--erp-border)" }}>
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ESTADOS_NOMINA_PAGO,
  ESTADO_NOMINA_PAGO_LABELS,
  FRECUENCIAS_INCIDENCIA,
  FRECUENCIAS_RECURRENCIA,
  FRECUENCIA_INCIDENCIA_LABELS,
  FRECUENCIA_RECURRENCIA_LABELS,
  MODOS_GENERACION_NOMINA,
  MODO_GENERACION_NOMINA_LABELS,
  SEXOS,
  SEXO_LABELS,
  TIPOS_NOMINA,
  TIPO_NOMINA_LABELS,
  type Empleado,
  type EmpleadoInput,
  type EstadoNominaPago,
  type FrecuenciaIncidencia,
  type FrecuenciaRecurrencia,
  type Locacion,
  type ModoGeneracionNomina,
  type Nomina,
  type NominaPago,
  type NominaResumen,
  type PeriodoNomina,
  type Sexo,
  type TipoIncidencia,
  type TipoNomina,
} from "@/lib/types";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });

function formatFechaCorta(fecha: string): string {
  return fecha.slice(8, 10) + "/" + fecha.slice(5, 7) + "/" + fecha.slice(0, 4);
}

async function consultarTasaBcv(): Promise<string | null> {
  try {
    const res = await fetch("/api/tasa-bcv");
    const data = await res.json();
    return res.ok ? String(data.tasa) : null;
  } catch {
    return null;
  }
}

const ESTADO_COLORES: Record<EstadoNominaPago, string> = {
  PENDIENTE: "#a16207",
  PAGADO: "#15803d",
};

/* ───────────────────────── Empleados ───────────────────────── */

function toTitleCase(s: string) {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatBs(value: string): string {
  const num = parseFloat(value.replace(/,/g, ""));
  if (isNaN(num)) return value;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type CargoOption = { id: number; nombre: string };

type EmpleadoForm = {
  nombre: string;
  apellido: string;
  cedula: string;
  fechaNacimiento: string;
  sexo: Sexo | "";
  cargo: string;
  cargoId: string;
  locacionId: string;
  nominaIds: number[];
  tasaRegistro: string;
  salarioBaseUsd: string;
  salarioBaseBs: string;
  salarioBaseBsDisplay: string;
  fechaIngreso: string;
  activo: boolean;
};

const EMPTY_EMPLEADO_FORM: EmpleadoForm = {
  nombre: "",
  apellido: "",
  cedula: "",
  fechaNacimiento: "",
  sexo: "",
  cargo: "",
  cargoId: "",
  locacionId: "",
  nominaIds: [],
  tasaRegistro: "",
  salarioBaseUsd: "",
  salarioBaseBs: "",
  salarioBaseBsDisplay: "",
  fechaIngreso: today(),
  activo: true,
};

function EmpleadosTab({ nominas }: { nominas: Nomina[] }) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [locaciones, setLocaciones] = useState<Locacion[]>([]);
  const [cargosOpts, setCargosOpts] = useState<CargoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EmpleadoForm>({ ...EMPTY_EMPLEADO_FORM });
  const [consultandoTasa, setConsultandoTasa] = useState(false);

  function recalcularBs(salarioBaseUsd: string, tasaRegistro: string): { raw: string; display: string } {
    const usd = Number(salarioBaseUsd) || 0;
    const tasa = Number(tasaRegistro) || 0;
    if (usd > 0 && tasa > 0) {
      const raw = (usd * tasa).toFixed(2);
      return { raw, display: formatBs(raw) };
    }
    return { raw: "", display: "" };
  }

  function handleSalarioUsdChange(value: string) {
    const bs = recalcularBs(value, form.tasaRegistro);
    setForm((p) => ({ ...p, salarioBaseUsd: value, salarioBaseBs: bs.raw, salarioBaseBsDisplay: bs.display }));
  }

  function handleTasaChange(value: string) {
    const bs = recalcularBs(form.salarioBaseUsd, value);
    setForm((p) => ({ ...p, tasaRegistro: value, salarioBaseBs: bs.raw, salarioBaseBsDisplay: bs.display }));
  }

  async function handleConsultarTasa() {
    setConsultandoTasa(true);
    const tasa = await consultarTasaBcv();
    if (tasa) handleTasaChange(tasa);
    setConsultandoTasa(false);
  }

  async function loadEmpleados() {
    setLoading(true);
    try {
      const res = await fetch("/api/empleados?activo=false");
      setEmpleados(await res.json());
    } catch {
      setError("No se pudieron cargar los empleados");
    } finally {
      setLoading(false);
    }
  }

  async function loadLocaciones() {
    const res = await fetch("/api/locaciones");
    if (res.ok) setLocaciones(await res.json());
  }

  async function loadCargos() {
    const res = await fetch("/api/cargos");
    if (res.ok) setCargosOpts(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEmpleados();
    loadLocaciones();
    loadCargos();
  }, []);

  // Auto-fetch tasa BCV al abrir el formulario de nuevo empleado
  useEffect(() => {
    if (showForm && !editingId && !form.tasaRegistro) {
      handleConsultarTasa();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_EMPLEADO_FORM });
    setShowForm(false);
  }

  function startEdit(e: Empleado) {
    setEditingId(e.id);
    const bsRaw = String(e.salarioBaseBs);
    setForm({
      nombre: e.nombre,
      apellido: e.apellido ?? "",
      cedula: e.cedula ?? "",
      fechaNacimiento: e.fechaNacimiento ?? "",
      sexo: e.sexo ?? "",
      cargo: e.cargo ?? "",
      cargoId: e.cargoId ? String(e.cargoId) : "",
      locacionId: e.locacionId ? String(e.locacionId) : "",
      nominaIds: e.nominaIds,
      tasaRegistro: e.tasaRegistro ? String(e.tasaRegistro) : "",
      salarioBaseUsd: e.salarioBaseUsd ? String(e.salarioBaseUsd) : "",
      salarioBaseBs: bsRaw,
      salarioBaseBsDisplay: formatBs(bsRaw),
      fechaIngreso: e.fechaIngreso ?? today(),
      activo: e.activo,
    });
    setShowForm(true);
  }

  function toggleNomina(nominaId: number) {
    setForm((p) => ({
      ...p,
      nominaIds: p.nominaIds.includes(nominaId) ? p.nominaIds.filter((id) => id !== nominaId) : [...p.nominaIds, nominaId],
    }));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!form.nombre.trim()) {
      setError("Indica el nombre del empleado");
      return;
    }
    setSaving(true);
    try {
      const cargoSeleccionado = cargosOpts.find((c) => String(c.id) === form.cargoId);
      const payload: EmpleadoInput = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        cedula: form.cedula.trim(),
        fechaNacimiento: form.fechaNacimiento,
        sexo: form.sexo || null,
        cargo: cargoSeleccionado?.nombre ?? form.cargo.trim(),
        cargoId: form.cargoId ? Number(form.cargoId) : null,
        locacionId: form.locacionId ? Number(form.locacionId) : null,
        nominaIds: form.nominaIds,
        salarioBaseUsd: Number(form.salarioBaseUsd) || 0,
        salarioBaseBs: Number(form.salarioBaseBs) || 0,
        tasaRegistro: Number(form.tasaRegistro) || 0,
        fechaIngreso: form.fechaIngreso,
        activo: form.activo,
      };
      const res = await fetch(editingId ? `/api/empleados/${editingId}` : "/api/empleados", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al guardar el empleado");
      resetForm();
      await loadEmpleados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el empleado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDesactivar(id: number) {
    if (!confirm("¿Desactivar este empleado?")) return;
    const res = await fetch(`/api/empleados/${id}`, { method: "DELETE" });
    if (res.ok) await loadEmpleados();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setForm({ ...EMPTY_EMPLEADO_FORM }); setEditingId(null); setShowForm((v) => !v); }}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--erp-accent)" }}
        >
          {showForm ? "Cancelar" : "+ Registrar Empleado"}
        </button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Nombre</label>
              <input className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} onBlur={() => setForm((p) => ({ ...p, nombre: toTitleCase(p.nombre) }))} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Apellido</label>
              <input className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.apellido} onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))} onBlur={() => setForm((p) => ({ ...p, apellido: toTitleCase(p.apellido) }))} placeholder="Ej: González" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Cargo</label>
              {cargosOpts.length > 0 ? (
                <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.cargoId} onChange={(e) => setForm((p) => ({ ...p, cargoId: e.target.value, cargo: "" }))}>
                  <option value="">— Seleccionar —</option>
                  {cargosOpts.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              ) : (
                <input className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.cargo} onChange={(e) => setForm((p) => ({ ...p, cargo: e.target.value }))} onBlur={() => setForm((p) => ({ ...p, cargo: toTitleCase(p.cargo) }))} placeholder="Ej: Cocinero" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>C.I.</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                style={{ borderColor: "var(--erp-border)" }}
                value={form.cedula}
                onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))}
                onBlur={() => setForm((p) => {
                  const v = p.cedula.trim();
                  if (v && /^\d+$/.test(v)) return { ...p, cedula: "V-" + v };
                  return p;
                })}
                placeholder="Ej: V-12345678"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>
                Fecha de nacimiento
                {form.fechaNacimiento && (() => {
                  const hoy = new Date(today() + "T00:00:00");
                  const nac = new Date(form.fechaNacimiento + "T00:00:00");
                  let edad = hoy.getFullYear() - nac.getFullYear();
                  if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
                  return <span className="ml-2 font-normal text-xs" style={{ color: "var(--erp-text-2)" }}>{edad} años</span>;
                })()}
              </label>
              <input type="date" className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.fechaNacimiento} onChange={(e) => setForm((p) => ({ ...p, fechaNacimiento: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Sexo</label>
              <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.sexo} onChange={(e) => setForm((p) => ({ ...p, sexo: e.target.value as Sexo | "" }))}>
                <option value="">—</option>
                {SEXOS.map((s) => <option key={s} value={s}>{SEXO_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Locación</label>
              <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.locacionId} onChange={(e) => setForm((p) => ({ ...p, locacionId: e.target.value }))}>
                <option value="">—</option>
                {locaciones.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>
                Fecha ingreso
                {form.fechaIngreso && (() => {
                  const hoy = new Date(today() + "T00:00:00");
                  const ing = new Date(form.fechaIngreso + "T00:00:00");
                  const dias = Math.floor((hoy.getTime() - ing.getTime()) / 86400000);
                  let antiguedad: string;
                  if (dias < 30) antiguedad = dias === 1 ? "1 día" : `${dias} días`;
                  else if (dias < 365) {
                    const meses = Math.floor(dias / 30);
                    antiguedad = meses === 1 ? "1 mes" : `${meses} meses`;
                  } else {
                    const anios = Math.floor(dias / 365);
                    const mesesRest = Math.floor((dias % 365) / 30);
                    antiguedad = anios === 1 ? "1 año" : `${anios} años`;
                    if (mesesRest > 0) antiguedad += ` ${mesesRest}m`;
                  }
                  return <span className="ml-2 font-normal text-xs" style={{ color: "var(--erp-text-2)" }}>{antiguedad}</span>;
                })()}
              </label>
              <input type="date" className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.fechaIngreso} onChange={(e) => setForm((p) => ({ ...p, fechaIngreso: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Tasa del día</label>
              <div className="flex gap-1">
                <input type="number" step="0.0001" min="0" className="rounded-md border px-3 py-2 text-sm flex-1" style={{ borderColor: "var(--erp-border)" }} value={form.tasaRegistro} onChange={(e) => handleTasaChange(e.target.value)} />
                <button type="button" onClick={handleConsultarTasa} disabled={consultandoTasa} className="text-xs px-2 rounded-md border disabled:opacity-50" style={{ borderColor: "var(--erp-border)" }}>
                  {consultandoTasa ? "…" : "BCV"}
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Salario Base $</label>
              <input type="number" step="0.01" min="0" className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.salarioBaseUsd} onChange={(e) => handleSalarioUsdChange(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Salario Base Bs</label>
              <input className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.salarioBaseBsDisplay} onChange={(e) => setForm((p) => ({ ...p, salarioBaseBs: e.target.value.replace(/,/g, ""), salarioBaseBsDisplay: e.target.value }))} onBlur={() => setForm((p) => ({ ...p, salarioBaseBsDisplay: formatBs(p.salarioBaseBs) }))} required />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Nóminas asignadas</label>
            {nominas.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--erp-text-2)" }}>No hay Nóminas creadas todavía. Créalas en la pestaña Nóminas.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {nominas.map((n) => (
                  <label key={n.id} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--erp-text)" }}>
                    <input type="checkbox" checked={form.nominaIds.includes(n.id)} onChange={() => toggleNomina(n.id)} />
                    {n.nombre}
                  </label>
                ))}
              </div>
            )}
          </div>

          {editingId && (
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--erp-text)" }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => setForm((p) => ({ ...p, activo: e.target.checked }))} />
              Activo
            </label>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}>Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--erp-primary)" }}>
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar Empleado"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : empleados.length === 0 ? (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)", color: "var(--erp-text)" }}>
          Sin empleados registrados.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--erp-border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--erp-text-2)" }}>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">C.I.</th>
                <th className="text-left px-3 py-2">Cargo</th>
                <th className="text-left px-3 py-2">Locación</th>
                <th className="text-left px-3 py-2">Nóminas</th>
                <th className="text-right px-3 py-2">Salario $</th>
                <th className="text-right px-3 py-2">Salario Bs</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--erp-border)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--erp-text)" }}>{e.nombre}{e.apellido ? ` ${e.apellido}` : ""}</td>
                  <td className="px-3 py-2">{e.cedula ?? "—"}</td>
                  <td className="px-3 py-2">{e.cargo ?? "—"}</td>
                  <td className="px-3 py-2">{e.locacionNombre ?? "—"}</td>
                  <td className="px-3 py-2">{e.nominaNombres.length ? e.nominaNombres.join(", ") : "—"}</td>
                  <td className="px-3 py-2 text-right">${e.salarioBaseUsd.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">Bs{formatBs(String(e.salarioBaseBs))}</td>
                  <td className="px-3 py-2">{e.activo ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(e)} className="text-xs" style={{ color: "var(--erp-primary)" }}>Editar</button>
                      {e.activo && <button type="button" onClick={() => handleDesactivar(e.id)} className="text-xs text-red-600">Desactivar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Nóminas (maestro) ───────────────────────── */

type IncidenciaConfigRow = {
  tipoIncidenciaId: string;
  frecuencia: FrecuenciaIncidencia;
  fechaEfectiva: string;
  tasaRegistro: string;
  montoUsd: string;
  montoBs: string;
};

const EMPTY_INCIDENCIA_ROW: IncidenciaConfigRow = {
  tipoIncidenciaId: "",
  frecuencia: "MENSUAL",
  fechaEfectiva: today(),
  tasaRegistro: "",
  montoUsd: "",
  montoBs: "",
};

function calcularFechaHastaSugerida(frecuencia: FrecuenciaRecurrencia, fechaDesde: string): string {
  const d = new Date(`${fechaDesde}T00:00:00`);
  if (frecuencia === "SEMANAL") d.setDate(d.getDate() + 6);
  else if (frecuencia === "QUINCENAL") d.setDate(d.getDate() + 14);
  else { d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sugerirRangoPeriodo(nomina: Nomina): { fechaDesde: string; fechaHasta: string } {
  const desde = nomina.ultimoPeriodoFechaHasta
    ? (() => {
        const d = new Date(`${nomina.ultimoPeriodoFechaHasta}T00:00:00`);
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })()
    : today();
  return { fechaDesde: desde, fechaHasta: calcularFechaHastaSugerida(nomina.frecuencia, desde) };
}

function GenerarPeriodoForm({ nomina, onCreated }: { nomina: Nomina; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({ ...sugerirRangoPeriodo(nomina), tasaDia: "" }));

  function handleAbrir() {
    setForm({ ...sugerirRangoPeriodo(nomina), tasaDia: "" });
    setOpen(true);
  }

  async function handleConsultarTasa() {
    const tasa = await consultarTasaBcv();
    if (tasa) setForm((p) => ({ ...p, tasaDia: tasa }));
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/nomina/periodos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nominaId: nomina.id, ...form, tasaDia: Number(form.tasaDia) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar el período");
      setOpen(false);
      setForm({ fechaDesde: today(), fechaHasta: today(), tasaDia: "" });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el período");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleAbrir} className="text-xs rounded-md border px-2 py-1" style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}>
        + Generar Período
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "var(--erp-border)" }}>
      <p className="text-xs" style={{ color: "var(--erp-text-2)" }}>
        Esto ejecuta la Nómina para el rango indicado: calcula el pago de cada empleado asignado
        (sueldo + incidencias vigentes en ese rango) y lo deja listo para marcar como pagado. Las fechas
        ya vienen sugeridas según la frecuencia y la última corrida.
      </p>
      {error && <div className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>}
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Desde</label>
          <input type="date" className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--erp-border)" }} value={form.fechaDesde} onChange={(e) => setForm((p) => ({ ...p, fechaDesde: e.target.value }))} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Hasta</label>
          <input type="date" className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--erp-border)" }} value={form.fechaHasta} onChange={(e) => setForm((p) => ({ ...p, fechaHasta: e.target.value }))} required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Tasa del día</label>
          <div className="flex gap-1">
            <input type="number" step="0.0001" min="0" className="rounded-md border px-2 py-1 text-xs w-24" style={{ borderColor: "var(--erp-border)" }} value={form.tasaDia} onChange={(e) => setForm((p) => ({ ...p, tasaDia: e.target.value }))} required />
            <button type="button" onClick={handleConsultarTasa} className="text-xs px-2 rounded-md border" style={{ borderColor: "var(--erp-border)" }}>BCV</button>
          </div>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-xs rounded-md border px-2 py-1.5" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>Cancelar</button>
        <button type="submit" disabled={saving} className="text-xs rounded-md px-3 py-1.5 font-semibold text-white disabled:opacity-60" style={{ background: "var(--erp-primary)" }}>
          {saving ? "Generando…" : "Generar"}
        </button>
      </div>
    </form>
  );
}

const TIPO_NOMINA_BADGE_COLOR: Record<TipoNomina, string> = {
  NORMAL: "#1d4ed8",
  SOLO_INCIDENCIAS: "#a16207",
  SOLO_SUELDO: "#15803d",
};

function NominaCard({ nomina, tiposIncidencia, onChange }: { nomina: Nomina; tiposIncidencia: TipoIncidencia[]; onChange: () => void }) {
  const [expandido, setExpandido] = useState(false);
  const [row, setRow] = useState<IncidenciaConfigRow>({ ...EMPTY_INCIDENCIA_ROW });
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);

  function recalcularBs(montoUsd: string, tasa: string) {
    const usd = Number(montoUsd) || 0;
    const t = Number(tasa) || 0;
    return usd > 0 && t > 0 ? (usd * t).toFixed(2) : "";
  }

  async function handleConsultarTasa() {
    const tasa = await consultarTasaBcv();
    if (tasa) setRow((p) => ({ ...p, tasaRegistro: tasa, montoBs: recalcularBs(p.montoUsd, tasa) }));
  }

  function startEditIncidencia(i: Nomina["incidenciasConfig"][number]) {
    setEditingConfigId(i.id);
    setRow({
      tipoIncidenciaId: String(i.tipoIncidenciaId),
      frecuencia: i.frecuencia,
      fechaEfectiva: i.fechaEfectiva,
      tasaRegistro: String(i.tasaRegistro || ""),
      montoUsd: String(i.montoUsd || ""),
      montoBs: String(i.montoBs || ""),
    });
  }

  function cancelarEdicionIncidencia() {
    setEditingConfigId(null);
    setRow({ ...EMPTY_INCIDENCIA_ROW });
  }

  async function handleGuardarIncidencia() {
    if (!row.tipoIncidenciaId) return;
    const payload = {
      tipoIncidenciaId: Number(row.tipoIncidenciaId),
      frecuencia: row.frecuencia,
      fechaEfectiva: row.fechaEfectiva,
      montoUsd: Number(row.montoUsd) || 0,
      montoBs: Number(row.montoBs) || 0,
      tasaRegistro: Number(row.tasaRegistro) || 0,
    };
    if (editingConfigId) {
      await fetch(`/api/nominas/incidencias/${editingConfigId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`/api/nominas/${nomina.id}/incidencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setEditingConfigId(null);
    setRow({ ...EMPTY_INCIDENCIA_ROW });
    onChange();
  }

  async function handleQuitarIncidencia(configId: number) {
    await fetch(`/api/nominas/incidencias/${configId}`, { method: "DELETE" });
    if (editingConfigId === configId) cancelarEdicionIncidencia();
    onChange();
  }

  async function handleDesactivar() {
    if (!confirm(`¿Desactivar la Nómina "${nomina.nombre}"?`)) return;
    await fetch(`/api/nominas/${nomina.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-left"
        style={{ background: "var(--erp-primary-lt)" }}
      >
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>{nomina.nombre}</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
            style={{ background: TIPO_NOMINA_BADGE_COLOR[nomina.tipo] }}
          >
            {TIPO_NOMINA_LABELS[nomina.tipo]}
          </span>
          <span className="text-xs" style={{ color: "var(--erp-text-2)" }}>
            {FRECUENCIA_RECURRENCIA_LABELS[nomina.frecuencia]} · {MODO_GENERACION_NOMINA_LABELS[nomina.modoGeneracion]}
            {nomina.modoGeneracion === "AUTOMATICO" && nomina.frecuencia === "SEMANAL" && nomina.diaSemana !== null && ` · Pago ${DIAS_SEMANA.find((d) => d.value === nomina.diaSemana)?.label ?? ""}`}
            {nomina.modoGeneracion === "AUTOMATICO" && nomina.frecuencia === "MENSUAL" && nomina.diaPago1 !== null && ` · Día ${nomina.diaPago1}`}
            {nomina.modoGeneracion === "AUTOMATICO" && nomina.frecuencia === "QUINCENAL" && nomina.diaPago1 !== null && ` · Días ${nomina.diaPago1} y ${nomina.diaPago2 ?? "?"}`}
          </span>
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>
          {nomina.empleadosAsignados} empleado(s) asignado(s)
        </span>
      </button>

      {expandido && (
        <div className="p-3 flex flex-col gap-3">
          <div className="flex justify-end gap-2">
            <GenerarPeriodoForm nomina={nomina} onCreated={onChange} />
            <button type="button" onClick={handleDesactivar} className="text-xs text-red-600">Desactivar Nómina</button>
          </div>

          {nomina.tipo !== "SOLO_SUELDO" && (
            <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "var(--erp-border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Incidencias configuradas</span>

              {nomina.incidenciasConfig.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {nomina.incidenciasConfig.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-xs" style={{ color: "var(--erp-text-2)" }}>
                      <span>
                        {i.tipoIncidenciaNombre} — {FRECUENCIA_INCIDENCIA_LABELS[i.frecuencia]} — efectiva {formatFechaCorta(i.fechaEfectiva)} — ${i.montoUsd.toFixed(2)} (Bs{i.montoBs.toFixed(2)})
                      </span>
                      <span className="flex gap-2">
                        <button type="button" onClick={() => startEditIncidencia(i)} style={{ color: "var(--erp-primary)" }}>Editar</button>
                        <button type="button" onClick={() => handleQuitarIncidencia(i.id)} className="text-red-600">Quitar</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Incidencia</label>
                  <select className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--erp-border)" }} value={row.tipoIncidenciaId} onChange={(e) => setRow((p) => ({ ...p, tipoIncidenciaId: e.target.value }))}>
                    <option value="">Selecciona…</option>
                    {tiposIncidencia.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Frecuencia</label>
                  <select className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--erp-border)" }} value={row.frecuencia} onChange={(e) => setRow((p) => ({ ...p, frecuencia: e.target.value as FrecuenciaIncidencia }))}>
                    {FRECUENCIAS_INCIDENCIA.map((f) => <option key={f} value={f}>{FRECUENCIA_INCIDENCIA_LABELS[f]}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Fecha efectiva</label>
                  <input type="date" className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--erp-border)" }} value={row.fechaEfectiva} onChange={(e) => setRow((p) => ({ ...p, fechaEfectiva: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Tasa</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.0001" min="0" className="rounded-md border px-2 py-1 text-xs w-20" style={{ borderColor: "var(--erp-border)" }} value={row.tasaRegistro} onChange={(e) => setRow((p) => ({ ...p, tasaRegistro: e.target.value, montoBs: recalcularBs(p.montoUsd, e.target.value) }))} />
                    <button type="button" onClick={handleConsultarTasa} className="text-xs px-1.5 rounded-md border" style={{ borderColor: "var(--erp-border)" }}>BCV</button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Monto $</label>
                  <input type="number" step="0.01" min="0" className="rounded-md border px-2 py-1 text-xs w-24" style={{ borderColor: "var(--erp-border)" }} value={row.montoUsd} onChange={(e) => setRow((p) => ({ ...p, montoUsd: e.target.value, montoBs: recalcularBs(e.target.value, p.tasaRegistro) }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs" style={{ color: "var(--erp-text-2)" }}>Monto Bs</label>
                  <input type="number" step="0.01" min="0" className="rounded-md border px-2 py-1 text-xs w-24" style={{ borderColor: "var(--erp-border)" }} value={row.montoBs} onChange={(e) => setRow((p) => ({ ...p, montoBs: e.target.value }))} />
                </div>
                <button type="button" onClick={handleGuardarIncidencia} className="text-xs rounded-md border px-2 py-1.5" style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}>
                  {editingConfigId ? "Guardar cambios" : "+ Agregar"}
                </button>
                {editingConfigId && (
                  <button type="button" onClick={cancelarEdicionIncidencia} className="text-xs rounded-md border px-2 py-1.5" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>
                    Cancelar edición
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DIAS_SEMANA = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const DIAS_CALENDARIO = Array.from({ length: 31 }, (_, i) => i + 1);

type NominaForm = {
  nombre: string;
  tipo: TipoNomina;
  frecuencia: FrecuenciaRecurrencia;
  modoGeneracion: ModoGeneracionNomina;
  diaSemana: string;
  diaPago1: string;
  diaPago2: string;
  centroCostoId: string;
};

const EMPTY_NOMINA_FORM: NominaForm = { nombre: "", tipo: "NORMAL", frecuencia: "QUINCENAL", modoGeneracion: "MANUAL", diaSemana: "5", diaPago1: "15", diaPago2: "30", centroCostoId: "" };

function NominasTab() {
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [tiposIncidencia, setTiposIncidencia] = useState<TipoIncidencia[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nuevoTipoIncidencia, setNuevoTipoIncidencia] = useState("");
  const [form, setForm] = useState<NominaForm>({ ...EMPTY_NOMINA_FORM });

  // silent=true evita mostrar "Cargando…" (lo que desmontaría las tarjetas y
  // colapsaría su vista expandida) cuando el refresco viene de un cambio menor
  // como agregar/quitar una incidencia.
  async function loadNominas(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/nominas");
      setNominas(await res.json());
    } catch {
      setError("No se pudieron cargar las Nóminas");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function loadTiposIncidencia() {
    const res = await fetch("/api/tipos-incidencia");
    if (res.ok) setTiposIncidencia(await res.json());
  }

  async function loadCentrosCosto() {
    const res = await fetch("/api/centros-costo");
    if (res.ok) setCentrosCosto(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNominas();
    loadTiposIncidencia();
    loadCentrosCosto();
  }, []);

  async function handleAgregarTipoIncidencia() {
    const nombre = nuevoTipoIncidencia.trim();
    if (!nombre) return;
    const res = await fetch("/api/tipos-incidencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (res.ok) {
      const tipo = await res.json();
      setTiposIncidencia((prev) => [...prev, tipo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevoTipoIncidencia("");
    }
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    if (!form.nombre.trim()) {
      setError("Indica el nombre de la Nómina");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/nominas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          frecuencia: form.frecuencia,
          modoGeneracion: form.modoGeneracion,
          diaSemana: form.modoGeneracion === "AUTOMATICO" && form.frecuencia === "SEMANAL" ? Number(form.diaSemana) : null,
          diaPago1: form.modoGeneracion === "AUTOMATICO" && form.frecuencia !== "SEMANAL" ? Number(form.diaPago1) : null,
          diaPago2: form.modoGeneracion === "AUTOMATICO" && form.frecuencia === "QUINCENAL" ? Number(form.diaPago2) : null,
          centroCostoId: form.centroCostoId ? Number(form.centroCostoId) : null,
          activo: true,
          incidencias: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detalle ? `${data.error ?? "Error"}: ${data.detalle}` : (data.error ?? "Error al crear la Nómina"));
      setShowForm(false);
      setForm({ ...EMPTY_NOMINA_FORM });
      await loadNominas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la Nómina");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-3 flex flex-wrap items-end gap-2" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>Catálogo de incidencias</label>
          <div className="flex gap-1">
            <input
              className="rounded-md border px-2 py-1 text-xs"
              style={{ borderColor: "var(--erp-border)" }}
              value={nuevoTipoIncidencia}
              onChange={(e) => setNuevoTipoIncidencia(e.target.value)}
              placeholder="Nueva incidencia (Ej: Bono)"
            />
            <button type="button" onClick={handleAgregarTipoIncidencia} className="text-xs px-2 rounded-md border" style={{ borderColor: "var(--erp-border)" }}>+</button>
          </div>
        </div>
        <span className="text-xs" style={{ color: "var(--erp-text-2)" }}>
          {tiposIncidencia.map((t) => t.nombre).join(" · ")}
        </span>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--erp-accent)" }}
        >
          {showForm ? "Cancelar" : "+ Nueva Nómina"}
        </button>
      </div>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border p-4 flex flex-col gap-3" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Nombre de la Nómina</label>
              <input className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Nómina Cocina" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Tipo</label>
              <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoNomina }))}>
                {TIPOS_NOMINA.map((t) => <option key={t} value={t}>{TIPO_NOMINA_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Frecuencia</label>
              <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.frecuencia} onChange={(e) => setForm((p) => ({ ...p, frecuencia: e.target.value as FrecuenciaRecurrencia }))}>
                {FRECUENCIAS_RECURRENCIA.map((f) => <option key={f} value={f}>{FRECUENCIA_RECURRENCIA_LABELS[f]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Generación de períodos</label>
              <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.modoGeneracion} onChange={(e) => setForm((p) => ({ ...p, modoGeneracion: e.target.value as ModoGeneracionNomina }))}>
                {MODOS_GENERACION_NOMINA.map((m) => <option key={m} value={m}>{MODO_GENERACION_NOMINA_LABELS[m]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Centro de Costo</label>
              <select className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--erp-border)" }} value={form.centroCostoId} onChange={(e) => setForm((p) => ({ ...p, centroCostoId: e.target.value }))}>
                <option value="">— Sin asignar —</option>
                {centrosCosto.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          {form.modoGeneracion === "AUTOMATICO" && form.frecuencia === "SEMANAL" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Día de pago</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, diaSemana: String(d.value) }))}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium border"
                    style={form.diaSemana === String(d.value)
                      ? { background: "var(--erp-primary)", color: "#fff", borderColor: "var(--erp-primary)" }
                      : { background: "var(--erp-surface)", color: "var(--erp-text)", borderColor: "var(--erp-border)" }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--erp-text-3)" }}>
                El cron generará el período cada {DIAS_SEMANA.find((d) => String(d.value) === form.diaSemana)?.label}.
              </p>
            </div>
          )}
          {form.modoGeneracion === "AUTOMATICO" && form.frecuencia === "MENSUAL" && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Día de pago mensual</label>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_CALENDARIO.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, diaPago1: String(d) }))}
                    className="rounded-md w-8 h-8 text-xs font-medium border"
                    style={form.diaPago1 === String(d)
                      ? { background: "var(--erp-primary)", color: "#fff", borderColor: "var(--erp-primary)" }
                      : { background: "var(--erp-surface)", color: "var(--erp-text)", borderColor: "var(--erp-border)" }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--erp-text-3)" }}>
                El cron generará el período el día {form.diaPago1} de cada mes.
              </p>
            </div>
          )}
          {form.modoGeneracion === "AUTOMATICO" && form.frecuencia === "QUINCENAL" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Primera quincena — día de pago</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_CALENDARIO.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, diaPago1: String(d) }))}
                      className="rounded-md w-8 h-8 text-xs font-medium border"
                      style={form.diaPago1 === String(d)
                        ? { background: "var(--erp-primary)", color: "#fff", borderColor: "var(--erp-primary)" }
                        : { background: "var(--erp-surface)", color: "var(--erp-text)", borderColor: "var(--erp-border)" }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: "var(--erp-text)" }}>Segunda quincena — día de pago</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS_CALENDARIO.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, diaPago2: String(d) }))}
                      className="rounded-md w-8 h-8 text-xs font-medium border"
                      style={form.diaPago2 === String(d)
                        ? { background: "var(--erp-accent)", color: "#fff", borderColor: "var(--erp-accent)" }
                        : { background: "var(--erp-surface)", color: "var(--erp-text)", borderColor: "var(--erp-border)" }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--erp-text-3)" }}>
                El cron generará períodos el día {form.diaPago1} y el día {form.diaPago2} de cada mes.
              </p>
            </div>
          )}
          <p className="text-xs" style={{ color: "var(--erp-text-2)" }}>
            Luego de crearla, asigna empleados desde su ficha y agrega las incidencias que apliquen antes de generar un período.
          </p>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ border: "1px solid var(--erp-border)", color: "var(--erp-text-2)" }}>Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--erp-primary)" }}>
              {saving ? "Creando..." : "Crear Nómina"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : nominas.length === 0 ? (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)", color: "var(--erp-text)" }}>
          Sin Nóminas creadas.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {nominas.map((n) => (
            <NominaCard key={n.id} nomina={n} tiposIncidencia={tiposIncidencia} onChange={() => loadNominas(true)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Períodos (corridas) ───────────────────────── */

function PeriodoCard({ periodo, tiposIncidencia, onChange }: {
  periodo: PeriodoNomina;
  tiposIncidencia: TipoIncidencia[];
  onChange: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [incidenciaForm, setIncidenciaForm] = useState<Record<number, { tipoIncidenciaId: string; frecuencia: FrecuenciaIncidencia; montoBs: string }>>({});

  async function handleCambiarEstadoPago(pago: NominaPago, estado: EstadoNominaPago) {
    await fetch(`/api/nomina/pagos/${pago.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    onChange();
  }

  async function handleAgregarIncidencia(pago: NominaPago) {
    const f = incidenciaForm[pago.id];
    if (!f?.tipoIncidenciaId) return;
    await fetch(`/api/nomina/pagos/${pago.id}/incidencias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoIncidenciaId: Number(f.tipoIncidenciaId),
        frecuencia: f.frecuencia,
        montoBs: Number(f.montoBs) || 0,
      }),
    });
    setIncidenciaForm((p) => ({ ...p, [pago.id]: { tipoIncidenciaId: "", frecuencia: "MENSUAL", montoBs: "" } }));
    onChange();
  }

  async function handleEliminarIncidencia(incidenciaId: number) {
    await fetch(`/api/nomina/incidencias/${incidenciaId}`, { method: "DELETE" });
    onChange();
  }

  async function handleCerrarPeriodo(estado: "ABIERTO" | "CERRADO") {
    await fetch(`/api/nomina/periodos/${periodo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    onChange();
  }

  async function handleEliminarPeriodo() {
    if (!confirm("¿Eliminar este período de nómina? Se perderán los pagos e incidencias asociados.")) return;
    await fetch(`/api/nomina/periodos/${periodo.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--erp-border)" }}>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-left"
        style={{ background: "var(--erp-primary-lt)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>
          {periodo.nominaNombre ?? "Nómina eliminada"} · {formatFechaCorta(periodo.fechaDesde)} – {formatFechaCorta(periodo.fechaHasta)}
          {" "}<span className="text-xs font-normal" style={{ color: "var(--erp-text-2)" }}>({periodo.estado === "ABIERTO" ? "Abierto" : "Cerrado"})</span>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>
          Bs{periodo.totalGeneralBs.toFixed(2)} · ${periodo.totalGeneralUsd.toFixed(2)}
        </span>
      </button>

      {expandido && (
        <div className="p-3 flex flex-col gap-3">
          <div className="flex justify-end gap-2">
            {periodo.estado === "ABIERTO" ? (
              <button type="button" onClick={() => handleCerrarPeriodo("CERRADO")} className="text-xs rounded-md border px-2 py-1" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>Cerrar período</button>
            ) : (
              <button type="button" onClick={() => handleCerrarPeriodo("ABIERTO")} className="text-xs rounded-md border px-2 py-1" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>Reabrir período</button>
            )}
            <button type="button" onClick={handleEliminarPeriodo} className="text-xs text-red-600">Eliminar período</button>
          </div>

          {periodo.pagos.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>No hay empleados asignados a esta Nómina.</p>
          ) : (
            periodo.pagos.map((pago) => (
              <div key={pago.id} className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "var(--erp-border)" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-semibold" style={{ color: "var(--erp-text)" }}>{pago.empleadoNombre}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--erp-text-2)" }}>
                      Salario Bs{pago.salarioBaseBs.toFixed(2)} + Incidencias Bs{pago.totalIncidenciasBs.toFixed(2)} = <strong>Bs{pago.totalBs.toFixed(2)} (${pago.totalUsd.toFixed(2)})</strong>
                    </span>
                    <select
                      value={pago.estado}
                      onChange={(e) => handleCambiarEstadoPago(pago, e.target.value as EstadoNominaPago)}
                      className="rounded-md border px-2 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--erp-border)", color: ESTADO_COLORES[pago.estado] }}
                    >
                      {ESTADOS_NOMINA_PAGO.map((s) => <option key={s} value={s}>{ESTADO_NOMINA_PAGO_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>

                {pago.incidencias.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {pago.incidencias.map((i) => (
                      <li key={i.id} className="flex items-center justify-between text-xs" style={{ color: "var(--erp-text-2)" }}>
                        <span>{i.tipoIncidenciaNombre}{i.frecuencia ? ` (${FRECUENCIA_INCIDENCIA_LABELS[i.frecuencia]})` : ""}: Bs{i.montoBs.toFixed(2)}</span>
                        <button type="button" onClick={() => handleEliminarIncidencia(i.id)} className="text-red-600">Quitar</button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex gap-2 items-end flex-wrap">
                  <select
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--erp-border)" }}
                    value={incidenciaForm[pago.id]?.tipoIncidenciaId ?? ""}
                    onChange={(e) => setIncidenciaForm((p) => ({ ...p, [pago.id]: { tipoIncidenciaId: e.target.value, frecuencia: p[pago.id]?.frecuencia ?? "MENSUAL", montoBs: p[pago.id]?.montoBs ?? "" } }))}
                  >
                    <option value="">Tipo de incidencia…</option>
                    {tiposIncidencia.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                  <select
                    className="rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: "var(--erp-border)" }}
                    value={incidenciaForm[pago.id]?.frecuencia ?? "MENSUAL"}
                    onChange={(e) => setIncidenciaForm((p) => ({ ...p, [pago.id]: { tipoIncidenciaId: p[pago.id]?.tipoIncidenciaId ?? "", frecuencia: e.target.value as FrecuenciaIncidencia, montoBs: p[pago.id]?.montoBs ?? "" } }))}
                  >
                    {FRECUENCIAS_INCIDENCIA.map((f) => <option key={f} value={f}>{FRECUENCIA_INCIDENCIA_LABELS[f]}</option>)}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Monto Bs"
                    className="rounded-md border px-2 py-1 text-xs w-28"
                    style={{ borderColor: "var(--erp-border)" }}
                    value={incidenciaForm[pago.id]?.montoBs ?? ""}
                    onChange={(e) => setIncidenciaForm((p) => ({ ...p, [pago.id]: { tipoIncidenciaId: p[pago.id]?.tipoIncidenciaId ?? "", frecuencia: p[pago.id]?.frecuencia ?? "MENSUAL", montoBs: e.target.value } }))}
                  />
                  <button type="button" onClick={() => handleAgregarIncidencia(pago)} className="text-xs rounded-md border px-2 py-1" style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}>
                    + Agregar incidencia
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PeriodosTab() {
  const [periodos, setPeriodos] = useState<PeriodoNomina[]>([]);
  const [tiposIncidencia, setTiposIncidencia] = useState<TipoIncidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPeriodos() {
    setLoading(true);
    try {
      const res = await fetch("/api/nomina/periodos");
      const data = await res.json();
      setPeriodos(data.periodos ?? []);
    } catch {
      setError("No se pudieron cargar los períodos");
    } finally {
      setLoading(false);
    }
  }

  async function loadTiposIncidencia() {
    const res = await fetch("/api/tipos-incidencia");
    if (res.ok) setTiposIncidencia(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPeriodos();
    loadTiposIncidencia();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs" style={{ color: "var(--erp-text-2)" }}>
        Los períodos se generan desde cada Nómina en la pestaña Nóminas (botón &quot;+ Generar Período&quot;).
      </p>

      {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--erp-text-2)" }}>Cargando…</p>
      ) : periodos.length === 0 ? (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ background: "var(--erp-primary-lt)", borderColor: "var(--erp-primary)", color: "var(--erp-text)" }}>
          Sin períodos de nómina registrados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {periodos.map((p) => (
            <PeriodoCard key={p.id} periodo={p} tiposIncidencia={tiposIncidencia} onChange={loadPeriodos} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Componente principal ───────────────────────── */

function StatTile({ label, value, color, prefix = "$" }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div className="rounded-xl border px-4 py-3 flex-1 min-w-[160px]" style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}>
      <div className="text-xs font-medium" style={{ color: "var(--erp-text-2)" }}>{label}</div>
      <div className="text-xl font-extrabold" style={{ color }}>{prefix}{value.toFixed(prefix === "$" ? 2 : 0)}</div>
    </div>
  );
}

export default function NominaClient() {
  const [tab, setTab] = useState<"nominas" | "periodos" | "empleados">("nominas");
  const [resumen, setResumen] = useState<NominaResumen>({ empleadosActivos: 0, nominaPendiente: 0, nominaPagadaMes: 0 });
  const [nominas, setNominas] = useState<Nomina[]>([]);

  async function loadResumen() {
    const res = await fetch("/api/nomina/resumen");
    if (res.ok) setResumen(await res.json());
  }

  async function loadNominasParaEmpleados() {
    const res = await fetch("/api/nominas");
    if (res.ok) setNominas(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadResumen();
    loadNominasParaEmpleados();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 flex-wrap">
        <StatTile label="Empleados Activos" value={resumen.empleadosActivos} color="var(--erp-text)" prefix="" />
        <StatTile label="Nómina Pendiente por Pagar" value={resumen.nominaPendiente} color="#a16207" />
        <StatTile label="Nómina Pagada este Mes" value={resumen.nominaPagadaMes} color="#15803d" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setTab("nominas")}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={tab === "nominas" ? { background: "var(--erp-primary)", color: "white" } : { background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)" }}
        >
          Nóminas
        </button>
        <button
          type="button"
          onClick={() => setTab("periodos")}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={tab === "periodos" ? { background: "var(--erp-primary)", color: "white" } : { background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)" }}
        >
          Períodos
        </button>
        <button
          type="button"
          onClick={() => { setTab("empleados"); loadNominasParaEmpleados(); }}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
          style={tab === "empleados" ? { background: "var(--erp-primary)", color: "white" } : { background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)" }}
        >
          Empleados
        </button>
      </div>

      {tab === "nominas" && <NominasTab />}
      {tab === "periodos" && <PeriodosTab />}
      {tab === "empleados" && <EmpleadosTab nominas={nominas} />}
    </div>
  );
}

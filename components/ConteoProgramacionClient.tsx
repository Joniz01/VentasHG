"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type Alcance = "TODOS" | "CATEGORIA" | "PRODUCTO" | "USO";
type Recurrencia = "DIARIA" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "FECHA";
type Uso = "MATERIA_PRIMA" | "PARA_LA_VENTA";

type Programacion = {
  id: number;
  nombre: string;
  alcance: Alcance;
  categoriaId: number | null;
  categoriaNombre: string | null;
  productoId: number | null;
  productoNombre: string | null;
  uso: Uso | null;
  recurrencia: Recurrencia;
  diasSemana: string[];
  diaNumero: number | null;
  fechaEspecifica: string | null;
  usuariosAlerta: number[];
  usuariosAlertaNombres: string[];
  activo: boolean;
  createdAt: string;
  venceHoy: boolean;
  proximaFecha: string | null;
};

type Categoria = { id: number; nombre: string };
type Producto = { id: number; nombre: string; grupo: string };
type Usuario = { id: number; nombre: string };

const DIAS_SEMANA = [
  { key: "LUN", label: "Lun" },
  { key: "MAR", label: "Mar" },
  { key: "MIE", label: "Mié" },
  { key: "JUE", label: "Jue" },
  { key: "VIE", label: "Vie" },
  { key: "SAB", label: "Sáb" },
  { key: "DOM", label: "Dom" },
];

const RECURRENCIA_LABELS: Record<Recurrencia, string> = {
  DIARIA: "Diaria",
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
  FECHA: "Fecha específica",
};

const ALCANCE_LABELS: Record<Alcance, string> = {
  TODOS: "Todos los productos",
  CATEGORIA: "Por categoría",
  PRODUCTO: "Por producto",
  USO: "Por uso",
};

type FormData = {
  nombre: string;
  alcance: Alcance;
  categoriaId: number | null;
  productoId: number | null;
  uso: Uso | null;
  recurrencia: Recurrencia;
  diasSemana: string[];
  diaNumero: number;
  fechaEspecifica: string;
  usuariosAlerta: number[];
};

const FORM_VACIO: FormData = {
  nombre: "",
  alcance: "TODOS",
  categoriaId: null,
  productoId: null,
  uso: null,
  recurrencia: "MENSUAL",
  diasSemana: [],
  diaNumero: 1,
  fechaEspecifica: "",
  usuariosAlerta: [],
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function alcanceResumen(p: Programacion): string {
  switch (p.alcance) {
    case "TODOS": return "Todos";
    case "CATEGORIA": return p.categoriaNombre ?? "—";
    case "PRODUCTO": return p.productoNombre ?? "—";
    case "USO": return p.uso === "MATERIA_PRIMA" ? "Materia Prima" : "Para la Venta";
  }
}

function recurrenciaResumen(p: Programacion): string {
  switch (p.recurrencia) {
    case "DIARIA": return "Diaria";
    case "SEMANAL": return `Semanal: ${p.diasSemana.join(", ")}`;
    case "QUINCENAL": return `Quincenal: día ${p.diaNumero} y ${Math.min((p.diaNumero ?? 1) + 15, 28)}`;
    case "MENSUAL": return `Mensual: día ${p.diaNumero}`;
    case "FECHA": return `Fecha: ${formatDate(p.fechaEspecifica)}`;
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ConteoProgramacionClient({ canEdit }: { canEdit: boolean }) {
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [listRes, datosRes] = await Promise.all([
        fetch("/api/conteo-programacion"),
        fetch("/api/conteo-programacion/datos"),
      ]);
      if (!listRes.ok) { setError("Error al cargar programaciones"); return; }
      const list = await listRes.json();
      setProgramaciones(list);
      if (datosRes.ok) {
        const datos = await datosRes.json();
        setCategorias(datos.categorias ?? []);
        setProductos(datos.productos ?? []);
        setUsuarios(datos.usuarios ?? []);
      }
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNueva = () => {
    setEditId(null);
    setForm(FORM_VACIO);
    setFormError(null);
    setShowForm(true);
  };

  const abrirEditar = (p: Programacion) => {
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      alcance: p.alcance,
      categoriaId: p.categoriaId,
      productoId: p.productoId,
      uso: p.uso,
      recurrencia: p.recurrencia,
      diasSemana: p.diasSemana,
      diaNumero: p.diaNumero ?? 1,
      fechaEspecifica: p.fechaEspecifica ?? "",
      usuariosAlerta: p.usuariosAlerta,
    });
    setFormError(null);
    setShowForm(true);
  };

  const cerrarForm = () => { setShowForm(false); setEditId(null); };

  const toggleActivo = async (p: Programacion) => {
    await fetch(`/api/conteo-programacion/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "toggle" }),
    });
    cargar();
  };

  const guardar = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const url = editId ? `/api/conteo-programacion/${editId}` : "/api/conteo-programacion";
      const method = editId ? "PATCH" : "POST";
      const body: Record<string, unknown> = {
        nombre: form.nombre,
        alcance: form.alcance,
        categoriaId: form.alcance === "CATEGORIA" ? form.categoriaId : null,
        productoId: form.alcance === "PRODUCTO" ? form.productoId : null,
        uso: form.alcance === "USO" ? form.uso : null,
        recurrencia: form.recurrencia,
        diasSemana: form.recurrencia === "SEMANAL" ? form.diasSemana : [],
        diaNumero: (form.recurrencia === "QUINCENAL" || form.recurrencia === "MENSUAL") ? form.diaNumero : null,
        fechaEspecifica: form.recurrencia === "FECHA" ? form.fechaEspecifica || null : null,
        usuariosAlerta: form.usuariosAlerta,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Error al guardar"); return; }
      cerrarForm();
      cargar();
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: number) => {
    await fetch(`/api/conteo-programacion/${id}`, { method: "DELETE" });
    setDeleteId(null);
    cargar();
  };

  const toggleDia = (dia: string) => {
    setForm((f) => ({
      ...f,
      diasSemana: f.diasSemana.includes(dia)
        ? f.diasSemana.filter((d) => d !== dia)
        : [...f.diasSemana, dia],
    }));
  };

  const toggleUsuario = (uid: number) => {
    setForm((f) => ({
      ...f,
      usuariosAlerta: f.usuariosAlerta.includes(uid)
        ? f.usuariosAlerta.filter((u) => u !== uid)
        : [...f.usuariosAlerta, uid],
    }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="text-sm p-6" style={{ color: "var(--erp-text-3)" }}>Cargando…</div>;
  if (error) return <div className="text-sm p-6 text-red-500">{error}</div>;

  const hoy = programaciones.filter((p) => p.activo && p.venceHoy);

  return (
    <div className="max-w-5xl">
      {/* Alert: due today */}
      {hoy.length > 0 && (
        <div
          className="mb-4 rounded-xl px-4 py-3 flex gap-3 items-start"
          style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}
        >
          <span className="text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-bold" style={{ color: "#92400E" }}>
              {hoy.length === 1 ? "1 conteo programado para hoy" : `${hoy.length} conteos programados para hoy`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
              {hoy.map((p) => p.nombre).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="text-base font-bold" style={{ color: "var(--erp-text)" }}>
          Programación de Conteos
        </h1>
        {canEdit && (
          <button
            onClick={abrirNueva}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-80"
            style={{ background: "var(--erp-primary)", color: "#fff" }}
          >
            + Nueva Programación
          </button>
        )}
      </div>

      {/* Form panel */}
      {showForm && (
        <FormPanel
          form={form}
          setForm={setForm}
          editId={editId}
          categorias={categorias}
          productos={productos}
          usuarios={usuarios}
          saving={saving}
          formError={formError}
          onGuardar={guardar}
          onCancelar={cerrarForm}
          toggleDia={toggleDia}
          toggleUsuario={toggleUsuario}
        />
      )}

      {/* Table */}
      {programaciones.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center text-sm"
          style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", color: "var(--erp-text-3)" }}
        >
          No hay programaciones configuradas.
          {canEdit && ' Haz clic en "+ Nueva Programación" para comenzar.'}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--erp-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ background: "var(--erp-surface)" }}>
              <thead>
                <tr style={{ background: "var(--erp-surface-2, var(--erp-surface))", borderBottom: "1px solid var(--erp-border)" }}>
                  {["Nombre", "Alcance", "Recurrencia", "Próxima fecha", "Usuarios alerta", "Estado", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--erp-text-3)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {programaciones.map((p) => (
                  <tr
                    key={p.id}
                    style={{ borderBottom: "1px solid var(--erp-border)" }}
                  >
                    <td className="px-3 py-2.5 font-semibold" style={{ color: "var(--erp-text)" }}>
                      {p.nombre}
                      {p.venceHoy && p.activo && (
                        <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "#FEF3C7", color: "#92400E" }}>HOY</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: "var(--erp-text-2)" }}>
                      <div className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--erp-text-3)" }}>{ALCANCE_LABELS[p.alcance]}</div>
                      {alcanceResumen(p)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-pre-wrap max-w-[180px]" style={{ color: "var(--erp-text-2)" }}>
                      {recurrenciaResumen(p)}
                    </td>
                    <td className="px-3 py-2.5 font-variant-numeric tabular-nums" style={{ color: "var(--erp-text-2)" }}>
                      {formatDate(p.proximaFecha)}
                    </td>
                    <td className="px-3 py-2.5 max-w-[160px]" style={{ color: "var(--erp-text-2)" }}>
                      {p.usuariosAlertaNombres.length === 0
                        ? <span style={{ color: "var(--erp-text-3)" }}>—</span>
                        : <span className="text-[11px]">{p.usuariosAlertaNombres.join(", ")}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit ? (
                        <button
                          onClick={() => toggleActivo(p)}
                          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                          style={{ background: p.activo ? "var(--erp-primary)" : "var(--erp-border)" }}
                          title={p.activo ? "Desactivar" : "Activar"}
                        >
                          <span
                            className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
                            style={{ transform: p.activo ? "translateX(18px)" : "translateX(2px)" }}
                          />
                        </button>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: p.activo ? "#DCFCE7" : "var(--erp-border)", color: p.activo ? "#15803D" : "var(--erp-text-3)" }}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrirEditar(p)}
                            className="text-[11px] font-semibold transition-opacity hover:opacity-70"
                            style={{ color: "var(--erp-primary)" }}
                          >
                            Editar
                          </button>
                          {deleteId === p.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => eliminar(p.id)}
                                className="text-[11px] font-bold text-red-500 hover:opacity-70"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="text-[11px] hover:opacity-70"
                                style={{ color: "var(--erp-text-3)" }}
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setDeleteId(p.id)}
                              className="text-[11px] font-semibold transition-opacity hover:opacity-70 text-red-500"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form Panel ───────────────────────────────────────────────────────────────

function FormPanel({
  form, setForm, editId,
  categorias, productos, usuarios,
  saving, formError,
  onGuardar, onCancelar,
  toggleDia, toggleUsuario,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  editId: number | null;
  categorias: Categoria[];
  productos: Producto[];
  usuarios: Usuario[];
  saving: boolean;
  formError: string | null;
  onGuardar: () => void;
  onCancelar: () => void;
  toggleDia: (d: string) => void;
  toggleUsuario: (uid: number) => void;
}) {
  const set = <K extends keyof FormData>(key: K, val: FormData[K]) => setForm((f) => ({ ...f, [key]: val }));

  const inputCls = "w-full rounded-lg border px-3 py-1.5 text-[12.5px] outline-none transition-colors focus:border-[var(--erp-primary)]";
  const inputStyle = { background: "var(--erp-surface)", borderColor: "var(--erp-border)", color: "var(--erp-text)" };
  const labelCls = "block text-[11px] font-bold uppercase tracking-wider mb-1";
  const labelStyle = { color: "var(--erp-text-3)" };

  return (
    <div
      className="mb-5 rounded-xl p-5"
      style={{ background: "var(--erp-surface)", border: "1.5px solid var(--erp-primary)" }}
    >
      <h2 className="text-sm font-bold mb-4" style={{ color: "var(--erp-text)" }}>
        {editId ? "Editar Programación" : "Nueva Programación"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nombre */}
        <div className="sm:col-span-2">
          <label className={labelCls} style={labelStyle}>Nombre</label>
          <input
            className={inputCls}
            style={inputStyle}
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Ej. Conteo semanal de materia prima"
          />
        </div>

        {/* Alcance */}
        <div>
          <label className={labelCls} style={labelStyle}>Alcance</label>
          <div className="flex flex-wrap gap-2">
            {(["TODOS", "CATEGORIA", "PRODUCTO", "USO"] as Alcance[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set("alcance", a)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors"
                style={{
                  background: form.alcance === a ? "var(--erp-primary)" : "var(--erp-surface)",
                  borderColor: form.alcance === a ? "var(--erp-primary)" : "var(--erp-border)",
                  color: form.alcance === a ? "#fff" : "var(--erp-text-2)",
                }}
              >
                {ALCANCE_LABELS[a]}
              </button>
            ))}
          </div>

          {/* Sub-field for alcance */}
          {form.alcance === "CATEGORIA" && (
            <select
              className={`${inputCls} mt-2`}
              style={inputStyle}
              value={form.categoriaId ?? ""}
              onChange={(e) => set("categoriaId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Selecciona categoría —</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
          {form.alcance === "PRODUCTO" && (
            <select
              className={`${inputCls} mt-2`}
              style={inputStyle}
              value={form.productoId ?? ""}
              onChange={(e) => set("productoId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Selecciona producto —</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          {form.alcance === "USO" && (
            <div className="flex gap-3 mt-2">
              {([["MATERIA_PRIMA", "Materia Prima"], ["PARA_LA_VENTA", "Para la Venta"]] as [Uso, string][]).map(([key, lbl]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer text-[12px]" style={{ color: "var(--erp-text-2)" }}>
                  <input type="radio" checked={form.uso === key} onChange={() => set("uso", key)} />
                  {lbl}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Recurrencia */}
        <div>
          <label className={labelCls} style={labelStyle}>Recurrencia</label>
          <div className="flex flex-wrap gap-2">
            {(["DIARIA", "SEMANAL", "QUINCENAL", "MENSUAL", "FECHA"] as Recurrencia[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set("recurrencia", r)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors"
                style={{
                  background: form.recurrencia === r ? "var(--erp-primary)" : "var(--erp-surface)",
                  borderColor: form.recurrencia === r ? "var(--erp-primary)" : "var(--erp-border)",
                  color: form.recurrencia === r ? "#fff" : "var(--erp-text-2)",
                }}
              >
                {RECURRENCIA_LABELS[r]}
              </button>
            ))}
          </div>

          {/* Sub-fields for recurrencia */}
          {form.recurrencia === "SEMANAL" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDia(d.key)}
                  className="rounded-md px-2.5 py-1 text-[11px] font-semibold border transition-colors"
                  style={{
                    background: form.diasSemana.includes(d.key) ? "#1D4ED8" : "var(--erp-surface)",
                    borderColor: form.diasSemana.includes(d.key) ? "#1D4ED8" : "var(--erp-border)",
                    color: form.diasSemana.includes(d.key) ? "#fff" : "var(--erp-text-2)",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
          {(form.recurrencia === "QUINCENAL" || form.recurrencia === "MENSUAL") && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[12px]" style={{ color: "var(--erp-text-2)" }}>Día del mes:</span>
              <input
                type="number"
                min={1}
                max={form.recurrencia === "QUINCENAL" ? 15 : 28}
                className="w-16 rounded-lg border px-2 py-1 text-[12.5px] outline-none"
                style={inputStyle}
                value={form.diaNumero}
                onChange={(e) => set("diaNumero", Number(e.target.value))}
              />
              {form.recurrencia === "QUINCENAL" && (
                <span className="text-[11px]" style={{ color: "var(--erp-text-3)" }}>
                  y día {Math.min(form.diaNumero + 15, 28)}
                </span>
              )}
            </div>
          )}
          {form.recurrencia === "FECHA" && (
            <input
              type="date"
              className={`${inputCls} mt-2`}
              style={inputStyle}
              value={form.fechaEspecifica}
              onChange={(e) => set("fechaEspecifica", e.target.value)}
            />
          )}
        </div>

        {/* Usuarios a alertar */}
        <div className="sm:col-span-2">
          <label className={labelCls} style={labelStyle}>Usuarios a alertar</label>
          {usuarios.length === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--erp-text-3)" }}>Sin usuarios disponibles</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {usuarios.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUsuario(u.id)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors"
                  style={{
                    background: form.usuariosAlerta.includes(u.id) ? "#0891B2" : "var(--erp-surface)",
                    borderColor: form.usuariosAlerta.includes(u.id) ? "#0891B2" : "var(--erp-border)",
                    color: form.usuariosAlerta.includes(u.id) ? "#fff" : "var(--erp-text-2)",
                  }}
                >
                  {u.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {formError && (
        <p className="mt-3 text-[12px] font-semibold text-red-500">{formError}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onGuardar}
          disabled={saving}
          className="rounded-lg px-4 py-1.5 text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--erp-primary)", color: "#fff" }}
        >
          {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear programación"}
        </button>
        <button
          onClick={onCancelar}
          className="rounded-lg px-4 py-1.5 text-xs font-bold border transition-colors hover:opacity-70"
          style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)", background: "var(--erp-surface)" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

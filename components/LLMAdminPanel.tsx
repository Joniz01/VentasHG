"use client";

import { useState, useEffect, useCallback } from "react";

type LLMKey = {
  id: number;
  provider: "gemini" | "groq";
  key_label: string;
  is_active: boolean;
  quota_limit: number | null;
  quota_used: number;
  quota_reset_at: string | null;
};

type UsageRow = {
  day: string;
  provider: string;
  calls_ok: number;
  calls_failback: number;
  calls_error: number;
  total_tokens: number;
  avg_latency_ms: number;
};

type TestResult = { ok: boolean; provider?: string; text?: string; latency?: number; error?: string };

type EditState = {
  key_label: string;
  api_key: string;
  quota_limit: string;
  showKey: boolean;
};

const EMPTY_FORM = { provider: "gemini" as "gemini" | "groq", key_label: "", api_key: "", quota_limit: "", showKey: false };

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function LLMAdminPanel() {
  const [keys, setKeys]       = useState<LLMKey[]>([]);
  const [usage, setUsage]     = useState<UsageRow[]>([]);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [globalTest, setGlobalTest] = useState<TestResult | null>(null);
  const [globalTesting, setGlobalTesting] = useState(false);
  const [keyTests, setKeyTests] = useState<Record<number, TestResult | null>>({});
  const [keyTesting, setKeyTesting] = useState<Record<number, boolean>>({});
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [migPending, setMigPending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ key_label: "", api_key: "", quota_limit: "", showKey: false });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Prompts editables
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [promptSaving, setPromptSaving] = useState<string | null>(null);
  const [promptMsg, setPromptMsg] = useState<Record<string, string>>({});

  // Orden de fallback OCR (Gemini primero por defecto)
  const [ocrOrden, setOcrOrden] = useState<"gemini" | "groq">("gemini");
  const [ocrOrdenSaving, setOcrOrdenSaving] = useState(false);
  const [ocrOrdenMsg, setOcrOrdenMsg] = useState("");

  const OCR_INSTRUCCIONES_DEFAULT = `- El RIF del emisor aparece cerca de "SENIAT" e inicia con J-, V-, E- o G-
- El teléfono puede venir precedido de: Teléfono, Telf, Tlf, Tel, Cel, Celular, Fono, Móvil
- La dirección del emisor suele aparecer debajo del nombre/RIF, antes de la fecha o el detalle de la factura (puede ocupar varias líneas: avenida, centro comercial, local, sector, ciudad, zona postal). Únela en un solo texto
- Si un ítem no tiene cantidad explícita, usa 1
- Reemplaza comas decimales por punto en los montos (ej: 2.189,58 → 2189.58)
- Si un campo no es legible usa null`;

  const PROMPT_DEFS = [
    {
      key: "compras_ocr_prompt",
      label: "Prompt OCR — Facturas de Compra",
      desc: "Estas instrucciones REEMPLAZAN por completo las de extracción al analizar una factura (no se agregan a otras). El formato de salida (nombres de campo JSON) es fijo y no se controla aquí — solo edita el texto de instrucciones.",
      defaultValue: OCR_INSTRUCCIONES_DEFAULT,
    },
  ];

  const fetchPrompts = useCallback(async () => {
    const r = await fetch("/api/configuracion");
    if (r.ok) {
      const data = await r.json();
      const filtered: Record<string, string> = {};
      for (const def of PROMPT_DEFS) {
        filtered[def.key] = data[def.key] || def.defaultValue;
      }
      setPrompts(filtered);
      setOcrOrden(data.ocr_provider_orden === "groq" ? "groq" : "gemini");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveOcrOrden(nuevo: "gemini" | "groq") {
    setOcrOrden(nuevo);
    setOcrOrdenSaving(true);
    try {
      const r = await fetch("/api/configuracion", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ocr_provider_orden: nuevo }) });
      if (!r.ok) throw new Error();
      setOcrOrdenMsg("Guardado");
      setTimeout(() => setOcrOrdenMsg(""), 2000);
    } catch {
      setOcrOrdenMsg("Error al guardar");
    } finally {
      setOcrOrdenSaving(false);
    }
  }

  async function savePrompt(key: string) {
    setPromptSaving(key);
    try {
      const r = await fetch("/api/configuracion", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: prompts[key] }) });
      if (!r.ok) throw new Error("Error al guardar");
      setPromptMsg((p) => ({ ...p, [key]: "Guardado" }));
      setTimeout(() => setPromptMsg((p) => ({ ...p, [key]: "" })), 2000);
    } catch { setPromptMsg((p) => ({ ...p, [key]: "Error al guardar" })); }
    finally { setPromptSaving(null); }
  }

  const fetchKeys = useCallback(async () => {
    const r = await fetch("/api/admin/llm/keys");
    if (r.status === 503) { setMigPending(true); return; }
    setMigPending(false);
    if (r.ok) setKeys(await r.json());
  }, []);

  const fetchUsage = useCallback(async () => {
    const r = await fetch("/api/admin/llm/usage?days=7");
    if (r.ok) setUsage(await r.json());
  }, []);

  useEffect(() => { fetchKeys(); fetchUsage(); fetchPrompts(); }, [fetchKeys, fetchUsage, fetchPrompts]);

  async function addKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const r = await fetch("/api/admin/llm/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, quota_limit: form.quota_limit ? Number(form.quota_limit) : null }),
    });
    setSaving(false);
    if (!r.ok) {
      const d = await r.json();
      setError(d.error ?? "Error al guardar");
      return;
    }
    setForm(EMPTY_FORM);
    fetchKeys();
  }

  async function toggleKey(id: number, is_active: boolean) {
    await fetch(`/api/admin/llm/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !is_active }),
    });
    fetchKeys();
  }

  async function resetQuota(id: number) {
    await fetch(`/api/admin/llm/keys/${id}/reset-quota`, { method: "POST" });
    fetchKeys();
  }

  async function deleteKey(id: number) {
    if (!confirm("¿Eliminar esta API key? Esta acción no se puede deshacer.")) return;
    await fetch(`/api/admin/llm/keys/${id}`, { method: "DELETE" });
    fetchKeys();
  }

  async function testConnection() {
    setGlobalTest(null);
    setGlobalTesting(true);
    const r = await fetch("/api/admin/llm/test", { method: "POST" });
    const data = await r.json();
    setGlobalTest(data);
    setGlobalTesting(false);
    fetchUsage();
  }

  async function testKey(id: number) {
    setKeyTests(prev => ({ ...prev, [id]: null }));
    setKeyTesting(prev => ({ ...prev, [id]: true }));
    const r = await fetch(`/api/admin/llm/test/${id}`, { method: "POST" });
    const data = await r.json();
    setKeyTests(prev => ({ ...prev, [id]: data }));
    setKeyTesting(prev => ({ ...prev, [id]: false }));
    fetchUsage();
  }

  function startEdit(k: LLMKey) {
    setEditingId(k.id);
    setEditState({
      key_label: k.key_label,
      api_key: "",
      quota_limit: k.quota_limit !== null ? String(k.quota_limit) : "",
      showKey: false,
    });
    setEditError(null);
  }

  async function saveEdit(id: number) {
    setEditError(null);
    setEditSaving(true);
    const body: Record<string, unknown> = {
      key_label: editState.key_label,
      quota_limit: editState.quota_limit ? Number(editState.quota_limit) : null,
    };
    if (editState.api_key.trim()) body.api_key = editState.api_key.trim();
    const r = await fetch(`/api/admin/llm/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditSaving(false);
    if (!r.ok) {
      const d = await r.json();
      setEditError(d.error ?? "Error al guardar");
      return;
    }
    setEditingId(null);
    fetchKeys();
  }

  if (migPending) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
        <p className="font-semibold">Migración pendiente</p>
        <p className="mt-1">Ejecutar <code className="bg-yellow-100 px-1 rounded">024_llm.sql</code> en Neon para habilitar esta sección.</p>
      </div>
    );
  }

  const geminiKeys = keys.filter(k => k.provider === "gemini");
  const groqKeys   = keys.filter(k => k.provider === "groq");

  return (
    <div className="flex flex-col gap-6">

      {/* Agregar key */}
      <div className="rounded-lg border border-zinc-200 p-4">
        <h3 className="mb-3 font-semibold text-sm">Nueva API Key</h3>
        <form onSubmit={addKey} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Proveedor</label>
            <select
              value={form.provider}
              onChange={e => setForm({ ...form, provider: e.target.value as "gemini" | "groq" })}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="gemini">Gemini (Google)</option>
              <option value="groq">Groq (failback)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Etiqueta</label>
            <input
              placeholder="ej: Gemini Producción"
              value={form.key_label}
              onChange={e => setForm({ ...form, key_label: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-zinc-500">API Key</label>
            <div className="relative">
              <input
                type={form.showKey ? "text" : "password"}
                placeholder="Pega aquí la API key"
                value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })}
                className="w-full rounded border border-zinc-300 px-3 py-2 pr-10 text-sm font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, showKey: !f.showKey }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                tabIndex={-1}
              >
                <EyeIcon open={form.showKey} />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Límite tokens/día (vacío = sin límite)</label>
            <input
              type="number"
              placeholder="ej: 100000"
              value={form.quota_limit}
              onChange={e => setForm({ ...form, quota_limit: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Agregar key"}
            </button>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        </form>
      </div>

      {/* Keys por proveedor */}
      {[{ label: "Gemini", keys: geminiKeys, color: "blue" }, { label: "Groq", keys: groqKeys, color: "green" }].map(({ label, keys: pKeys, color }) => (
        <div key={label}>
          <h3 className="mb-2 font-semibold text-sm flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full bg-${color}-500`} />
            {label}
            {label === "Groq" && <span className="text-xs text-zinc-400 font-normal">— failback automático</span>}
          </h3>
          {pKeys.length === 0 ? (
            <p className="text-sm text-zinc-400">Sin keys configuradas.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500">
                  <tr>
                    <th className="p-2 text-left">Etiqueta</th>
                    <th className="p-2 text-right">Tokens usados</th>
                    <th className="p-2 text-right">Límite</th>
                    <th className="p-2 text-center">Estado</th>
                    <th className="p-2 text-center">Test</th>
                    <th className="p-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pKeys.map(k => {
                    const pct = k.quota_limit ? Math.round((k.quota_used / k.quota_limit) * 100) : null;
                    const isEditing = editingId === k.id;
                    const kr = keyTests[k.id];
                    return (
                      <>
                        <tr key={k.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                          <td className="p-2 font-medium">{k.key_label}</td>
                          <td className="p-2 text-right font-mono">
                            {k.quota_used.toLocaleString()}
                            {pct !== null && (
                              <span className={`ml-1 text-xs ${pct >= 90 ? "text-red-500" : pct >= 70 ? "text-yellow-500" : "text-zinc-400"}`}>
                                ({pct}%)
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right text-zinc-400 font-mono">
                            {k.quota_limit ? k.quota_limit.toLocaleString() : "—"}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${k.is_active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>
                              {k.is_active ? "Activa" : "Inactiva"}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => testKey(k.id)}
                              disabled={keyTesting[k.id]}
                              className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50"
                            >
                              {keyTesting[k.id] ? "…" : "Probar"}
                            </button>
                          </td>
                          <td className="p-2">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => isEditing ? setEditingId(null) : startEdit(k)}
                                className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                {isEditing ? "Cancelar" : "Editar"}
                              </button>
                              <button
                                onClick={() => toggleKey(k.id, k.is_active)}
                                className="rounded border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                {k.is_active ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                onClick={() => resetQuota(k.id)}
                                className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-100"
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => deleteKey(k.id)}
                                className="rounded border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                        {kr !== null && kr !== undefined && (
                          <tr key={`test-${k.id}`} className="border-t border-zinc-100 bg-zinc-50">
                            <td colSpan={6} className="px-3 py-1.5 text-xs">
                              {kr.ok
                                ? <span className="text-green-600">✓ OK — "{kr.text}" · {kr.latency}ms</span>
                                : <span className="text-red-600">✗ Error: {kr.error}</span>}
                            </td>
                          </tr>
                        )}
                        {isEditing && (
                          <tr key={`edit-${k.id}`} className="border-t border-blue-100 bg-blue-50">
                            <td colSpan={6} className="p-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                  <label className="mb-1 block text-xs text-zinc-500">Etiqueta</label>
                                  <input
                                    value={editState.key_label}
                                    onChange={e => setEditState(s => ({ ...s, key_label: e.target.value }))}
                                    className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-zinc-500">Nueva API Key (vacío = no cambiar)</label>
                                  <div className="relative">
                                    <input
                                      type={editState.showKey ? "text" : "password"}
                                      placeholder="Dejar vacío para no cambiar"
                                      value={editState.api_key}
                                      onChange={e => setEditState(s => ({ ...s, api_key: e.target.value }))}
                                      className="w-full rounded border border-zinc-300 px-2 py-1.5 pr-8 text-sm font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setEditState(s => ({ ...s, showKey: !s.showKey }))}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                      tabIndex={-1}
                                    >
                                      <EyeIcon open={editState.showKey} />
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs text-zinc-500">Límite tokens/día</label>
                                  <input
                                    type="number"
                                    placeholder="vacío = sin límite"
                                    value={editState.quota_limit}
                                    onChange={e => setEditState(s => ({ ...s, quota_limit: e.target.value }))}
                                    className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  onClick={() => saveEdit(k.id)}
                                  disabled={editSaving}
                                  className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                                >
                                  {editSaving ? "Guardando…" : "Guardar cambios"}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="rounded border border-zinc-200 px-3 py-1.5 text-xs hover:bg-zinc-100"
                                >
                                  Cancelar
                                </button>
                                {editError && <span className="text-xs text-red-600">{editError}</span>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Test de conexión global */}
      <div className="flex items-center gap-3">
        <button
          onClick={testConnection}
          disabled={globalTesting || keys.filter(k => k.is_active).length === 0}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {globalTesting ? "Probando…" : "Probar conexión (global)"}
        </button>
        {globalTest && (
          <span className={`text-sm ${globalTest.ok ? "text-green-600" : "text-red-600"}`}>
            {globalTest.ok
              ? `✓ OK — respondió ${globalTest.provider}: "${globalTest.text}"`
              : `✗ Error: ${globalTest.error}`}
          </span>
        )}
      </div>

      {/* Uso últimos 7 días */}
      <div>
        <h3 className="mb-2 font-semibold text-sm">Uso — últimos 7 días</h3>
        {usage.length === 0 ? (
          <p className="text-sm text-zinc-400">Sin registros de uso aún.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="p-2 text-left">Día</th>
                  <th className="p-2 text-left">Proveedor</th>
                  <th className="p-2 text-right">OK</th>
                  <th className="p-2 text-right">Failback</th>
                  <th className="p-2 text-right">Error</th>
                  <th className="p-2 text-right">Tokens</th>
                  <th className="p-2 text-right">Latencia</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="p-2 font-mono text-xs text-zinc-500">
                      {new Date(u.day).toLocaleDateString("es-VE")}
                    </td>
                    <td className="p-2">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${u.provider === "gemini" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                        {u.provider}
                      </span>
                    </td>
                    <td className="p-2 text-right text-green-600">{u.calls_ok}</td>
                    <td className="p-2 text-right text-yellow-600">{u.calls_failback}</td>
                    <td className="p-2 text-right text-red-600">{u.calls_error}</td>
                    <td className="p-2 text-right font-mono">{Number(u.total_tokens).toLocaleString()}</td>
                    <td className="p-2 text-right text-zinc-400">{u.avg_latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orden de fallback OCR */}
      <div className="mt-6 rounded-xl border border-zinc-200 p-4">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-zinc-400">Orden de proveedores — OCR de Facturas</h3>
        <p className="mb-3 text-xs text-zinc-500">Elige qué proveedor se intenta primero al escanear una factura. El otro se usa automáticamente como respaldo si el primero falla o no tiene cuota.</p>
        <div className="flex items-center gap-2">
          <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--erp-border)", overflow: "hidden" }}>
            {(["gemini", "groq"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => saveOcrOrden(p)}
                disabled={ocrOrdenSaving}
                style={{
                  padding: "8px 16px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                  background: ocrOrden === p ? "var(--erp-primary)" : "var(--erp-surface)",
                  color: ocrOrden === p ? "#fff" : "var(--erp-text-2)",
                }}
              >
                {p === "gemini" ? "Gemini primero" : "Groq primero"}
              </button>
            ))}
          </div>
          {ocrOrdenMsg && (
            <span style={{ fontSize: 12, color: ocrOrdenMsg === "Guardado" ? "#166534" : "#B91C1C" }}>{ocrOrdenMsg}</span>
          )}
        </div>
      </div>

      {/* Prompts editables */}
      <div className="mt-6 rounded-xl border border-zinc-200 p-4">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-zinc-400">Prompts de IA</h3>
        <p className="mb-4 text-xs text-zinc-500">Instrucciones enviadas al modelo en cada función. Edítalas para ajustar el comportamiento.</p>
        <div className="flex flex-col gap-5">
          {PROMPT_DEFS.map((def) => (
            <div key={def.key}>
              <div className="mb-1 text-sm font-semibold text-zinc-700">{def.label}</div>
              <div className="mb-2 text-xs text-zinc-400">{def.desc}</div>
              <textarea
                value={prompts[def.key] ?? ""}
                onChange={(e) => setPrompts((p) => ({ ...p, [def.key]: e.target.value }))}
                rows={8}
                style={{ width: "100%", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, background: "var(--erp-bg)", color: "var(--erp-text)", resize: "vertical", fontFamily: "inherit" }}
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => savePrompt(def.key)}
                  disabled={promptSaving === def.key}
                  style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: promptSaving === def.key ? 0.7 : 1 }}
                >
                  {promptSaving === def.key ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setPrompts((p) => ({ ...p, [def.key]: def.defaultValue }))}
                  style={{ background: "transparent", color: "var(--erp-text-2)", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Restaurar por defecto
                </button>
                {promptMsg[def.key] && (
                  <span style={{ fontSize: 12, color: promptMsg[def.key] === "Guardado" ? "#166534" : "#B91C1C" }}>{promptMsg[def.key]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

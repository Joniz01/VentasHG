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

type TestResult = { ok: boolean; provider?: string; text?: string; error?: string };

const EMPTY_FORM = { provider: "gemini" as "gemini" | "groq", key_label: "", api_key: "", quota_limit: "" };

export default function LLMAdminPanel() {
  const [keys, setKeys]       = useState<LLMKey[]>([]);
  const [usage, setUsage]     = useState<UsageRow[]>([]);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [testResult, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [migPending, setMigPending] = useState(false);

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

  useEffect(() => { fetchKeys(); fetchUsage(); }, [fetchKeys, fetchUsage]);

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
    setTest(null);
    setTesting(true);
    const r = await fetch("/api/admin/llm/test", { method: "POST" });
    const data = await r.json();
    setTest(data);
    setTesting(false);
    fetchUsage();
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
            <input
              type="password"
              placeholder="Pega aquí la API key"
              value={form.api_key}
              onChange={e => setForm({ ...form, api_key: e.target.value })}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono"
              required
            />
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
                    <th className="p-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pKeys.map(k => {
                    const pct = k.quota_limit ? Math.round((k.quota_used / k.quota_limit) * 100) : null;
                    return (
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
                        <td className="p-2">
                          <div className="flex justify-center gap-1">
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
                              Reset cuota
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Test de conexión */}
      <div className="flex items-center gap-3">
        <button
          onClick={testConnection}
          disabled={testing || keys.filter(k => k.is_active).length === 0}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {testing ? "Probando…" : "Probar conexión"}
        </button>
        {testResult && (
          <span className={`text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
            {testResult.ok
              ? `✓ OK — respondió ${testResult.provider}: "${testResult.text}"`
              : `✗ Error: ${testResult.error}`}
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
    </div>
  );
}

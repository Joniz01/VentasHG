"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function DeliveryLoginClient() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showClave, setShowClave] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/delivery-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo iniciar sesión");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Usuario</label>
        <input
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700">Clave</label>
        <div style={{ position: "relative" }}>
          <input
            type={showClave ? "text" : "password"}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
            style={{ paddingRight: 36 }}
          />
          <button
            type="button"
            onClick={() => setShowClave((v) => !v)}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--erp-text-3)" }}
            tabIndex={-1}
            aria-label={showClave ? "Ocultar clave" : "Ver clave"}
          >
            {showClave ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {saving ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}

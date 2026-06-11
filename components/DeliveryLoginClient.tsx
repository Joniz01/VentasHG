"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function DeliveryLoginClient() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        <input
          type="password"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          required
        />
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

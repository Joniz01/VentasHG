"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Props = {
  hayUsuarios: boolean;
};

export default function LoginClient({ hayUsuarios }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo iniciar sesión");
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setSaving(false);
    }
  }

  async function handleBootstrap(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (clave !== confirmarClave) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          usuario: usuario.trim(),
          clave,
          rol: "ADMIN",
          permisos: { productos: true, ventas: true, reportes: true, pedidosPendientes: true },
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo crear el usuario administrador");
      }

      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      if (!loginRes.ok) {
        throw new Error("Usuario creado, pero no se pudo iniciar sesión");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el usuario administrador");
    } finally {
      setSaving(false);
    }
  }

  if (!hayUsuarios) {
    return (
      <form
        onSubmit={handleBootstrap}
        className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <p className="text-sm text-zinc-600">
          Crea la cuenta de administrador inicial para proteger el acceso al sistema.
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Nombre</label>
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
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
          <label className="text-sm font-medium text-zinc-700">Contraseña</label>
          <input
            type="password"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700">Confirmar contraseña</label>
          <input
            type="password"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            value={confirmarClave}
            onChange={(e) => setConfirmarClave(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear administrador"}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleLogin}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
    >
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
        <label className="text-sm font-medium text-zinc-700">Contraseña</label>
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

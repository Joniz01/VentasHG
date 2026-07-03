"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Perfil = { nombre: string; usuario: string; telefono: string | null; correo: string | null };
type Vista = "menu" | "perfil" | "clave";

export default function PerfilMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vista, setVista] = useState<Vista>("menu");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [claveActual, setClaveActual] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [claveConfirm, setClaveConfirm] = useState("");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/usuarios/perfil")
      .then((r) => r.json())
      .then((d: Perfil) => {
        setPerfil(d);
        setTelefono(d.telefono ?? "");
        setCorreo(d.correo ?? "");
      });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setVista("menu");
        setMsg(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function cerrarSesion() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin");
  }

  async function guardarPerfil() {
    const res = await fetch("/api/usuarios/perfil", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono, correo }),
    });
    setMsg(res.ok ? { texto: "Guardado correctamente" } : { texto: "Error al guardar", error: true });
    if (res.ok) setPerfil((p) => p ? { ...p, telefono, correo } : p);
  }

  async function cambiarClave() {
    setMsg(null);
    if (claveNueva !== claveConfirm) {
      setMsg({ texto: "Las claves no coinciden", error: true });
      return;
    }
    if (claveNueva.length < 6) {
      setMsg({ texto: "Mínimo 6 caracteres", error: true });
      return;
    }
    const res = await fetch("/api/usuarios/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: claveActual, newPassword: claveNueva }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ texto: "Clave actualizada" });
      setClaveActual(""); setClaveNueva(""); setClaveConfirm("");
    } else {
      setMsg({ texto: data.error ?? "Error al cambiar clave", error: true });
    }
  }

  const iniciales = perfil?.nombre?.slice(0, 2).toUpperCase() ?? "··";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); setVista("menu"); setMsg(null); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white hover:bg-zinc-700"
        title="Mi perfil"
      >
        {iniciales}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg">
          {vista === "menu" && (
            <div className="flex flex-col">
              <div className="border-b border-zinc-100 px-4 py-3">
                <p className="font-semibold text-zinc-800">{perfil?.nombre}</p>
                <p className="text-xs text-zinc-500">@{perfil?.usuario}</p>
              </div>
              <button onClick={() => { setVista("perfil"); setMsg(null); }}
                className="px-4 py-2.5 text-left text-sm hover:bg-zinc-50">
                Editar perfil (teléfono / correo)
              </button>
              <button onClick={() => { setVista("clave"); setMsg(null); }}
                className="px-4 py-2.5 text-left text-sm hover:bg-zinc-50">
                Cambiar contraseña
              </button>
              <div className="border-t border-zinc-100">
                <button onClick={cerrarSesion}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}

          {vista === "perfil" && (
            <div className="flex flex-col gap-3 p-4">
              <button onClick={() => { setVista("menu"); setMsg(null); }}
                className="self-start text-xs text-zinc-400 hover:text-zinc-700">
                ← Volver
              </button>
              <p className="font-semibold text-zinc-800">Editar perfil</p>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Teléfono
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 584129002211"
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Correo
                <input value={correo} onChange={(e) => setCorreo(e.target.value)}
                  placeholder="usuario@email.com" type="email"
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500" />
              </label>
              {msg && <p className={`text-xs ${msg.error ? "text-red-600" : "text-green-600"}`}>{msg.texto}</p>}
              <button onClick={guardarPerfil}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                Guardar
              </button>
            </div>
          )}

          {vista === "clave" && (
            <div className="flex flex-col gap-3 p-4">
              <button onClick={() => { setVista("menu"); setMsg(null); }}
                className="self-start text-xs text-zinc-400 hover:text-zinc-700">
                ← Volver
              </button>
              <p className="font-semibold text-zinc-800">Cambiar contraseña</p>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Contraseña actual
                <input value={claveActual} onChange={(e) => setClaveActual(e.target.value)}
                  type="password"
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Nueva contraseña
                <input value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)}
                  type="password"
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-600">
                Confirmar nueva contraseña
                <input value={claveConfirm} onChange={(e) => setClaveConfirm(e.target.value)}
                  type="password"
                  className="rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500" />
              </label>
              {msg && <p className={`text-xs ${msg.error ? "text-red-600" : "text-green-600"}`}>{msg.texto}</p>}
              <button onClick={cambiarClave}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                Actualizar clave
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

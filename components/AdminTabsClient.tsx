"use client";

import { useState } from "react";
import AlarmasConfigClient from "@/components/AlarmasConfigClient";
import ConfiguracionClient from "@/components/ConfiguracionClient";
import MotorizadosConfigClient from "@/components/MotorizadosConfigClient";
import UsuariosConfigClient from "@/components/UsuariosConfigClient";
import AdminAccesoClient from "@/components/AdminAccesoClient";
import InventarioInicialClient from "@/components/InventarioInicialClient";

type Props = {
  usuarioActualId: number;
  nombre: string;
  usuario: string;
};

const TABS = [
  { key: "usuarios", label: "Usuarios" },
  { key: "alarmas", label: "Alarmas" },
  { key: "configuracion", label: "Configuración" },
  { key: "inventario", label: "Inventario Inicial" },
  { key: "acceso", label: "Acceso al Sistema" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminTabsClient({ usuarioActualId, nombre, usuario }: Props) {
  const [tab, setTab] = useState<TabKey>("usuarios");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 hover:bg-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "usuarios" && (
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-4 text-lg font-semibold">Usuarios del sistema</h2>
            <p className="mb-4 text-sm text-zinc-600">
              Crea y gestiona los usuarios con acceso al sistema y sus permisos por sección.
            </p>
            <UsuariosConfigClient usuarioActualId={usuarioActualId} />
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold">Motorizados (Delivery)</h2>
            <p className="mb-4 text-sm text-zinc-600">
              Crea y gestiona los usuarios de los motorizados encargados de las entregas.
            </p>
            <MotorizadosConfigClient />
          </div>
        </div>
      )}

      {tab === "alarmas" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Configuración de Alarmas</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Configura el sonido y comportamiento de las alarmas de Pedidos Pendientes.
          </p>
          <AlarmasConfigClient />
        </div>
      )}

      {tab === "configuracion" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Configuración del sistema</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Ajusta los parámetros generales del sistema.
          </p>
          <ConfiguracionClient />
        </div>
      )}

      {tab === "inventario" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Inventario Inicial</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Inicialización de operaciones: lleva el inventario de todos los productos a cero.
          </p>
          <InventarioInicialClient />
        </div>
      )}

      {tab === "acceso" && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Admin Acceso al Sistema</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Administra el acceso de tu propia cuenta.
          </p>
          <AdminAccesoClient nombre={nombre} usuario={usuario} />
        </div>
      )}
    </div>
  );
}

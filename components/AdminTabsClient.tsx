"use client";

import { useState } from "react";
import AlarmasConfigClient from "@/components/AlarmasConfigClient";
import ConfiguracionClient from "@/components/ConfiguracionClient";
import MotorizadosConfigClient from "@/components/MotorizadosConfigClient";
import UsuariosConfigClient from "@/components/UsuariosConfigClient";
import AdminAccesoClient from "@/components/AdminAccesoClient";
import InventarioInicialClient from "@/components/InventarioInicialClient";
import LLMAdminPanel from "@/components/LLMAdminPanel";
import ConteoUsuariosConfigClient from "@/components/ConteoUsuariosConfigClient";
import TiposGastoConfigClient from "@/components/TiposGastoConfigClient";
import CentrosCostoConfigClient from "@/components/CentrosCostoConfigClient";
import CargosConfigClient from "@/components/CargosConfigClient";

type Props = {
  usuarioActualId: number;
  nombre: string;
  usuario: string;
  esAdmin?: boolean;
};

const TABS = [
  { key: "usuarios",      label: "Usuarios",           icon: "👥", desc: "Gestiona usuarios y permisos" },
  { key: "alarmas",       label: "Alarmas",             icon: "🔔", desc: "Sonido y comportamiento de alertas" },
  { key: "configuracion", label: "Configuración",       icon: "⚙️",  desc: "Parámetros generales del sistema" },
  { key: "inventario",    label: "Inventario Inicial",  icon: "📦", desc: "Reiniciar inventario de productos" },
  { key: "acceso",        label: "Acceso al Sistema",   icon: "🔐", desc: "Contraseña y sesión" },
  { key: "llm",           label: "IA / LLM",            icon: "🤖", desc: "API keys de Gemini y Groq" },
  { key: "conteo",        label: "Conteo Inventario",   icon: "📋", desc: "Usuarios de conteo físico" },
  { key: "gastos-config",   label: "Gastos",              icon: "🧾", desc: "Tipos de gasto configurables" },
  { key: "centros-costo",   label: "Centros de Costo",    icon: "🏢", desc: "Sucursales y centros de costo" },
  { key: "cargos",          label: "Cargos",               icon: "💼", desc: "Cargos y posiciones de empleados" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminTabsClient({ usuarioActualId, nombre, usuario, esAdmin = true }: Props) {
  const [tab, setTab] = useState<TabKey | null>(null);
  const tabsVisibles = esAdmin ? TABS : TABS.filter((t) => t.key === "gastos-config");

  if (!tab) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {tabsVisibles.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "0.4rem",
                padding: "1rem 1.1rem",
                background: "var(--erp-surface)",
                border: "1px solid var(--erp-border)",
                borderRadius: "10px",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--erp-primary)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 3px var(--erp-primary-lt)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--erp-border)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{t.icon}</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--erp-text)" }}>{t.label}</span>
              <span style={{ fontSize: "0.775rem", color: "var(--erp-text-2)", lineHeight: 1.35 }}>{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          type="button"
          onClick={() => setTab(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.75rem",
            background: "transparent",
            border: "1px solid var(--erp-border)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.8rem",
            color: "var(--erp-text-2)",
          }}
        >
          ← Volver
        </button>
        <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--erp-text)" }}>
          {current.icon} {current.label}
        </span>
      </div>

      {tab === "usuarios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
              Crea y gestiona los usuarios con acceso al sistema y sus permisos por sección.
            </p>
            <UsuariosConfigClient usuarioActualId={usuarioActualId} />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--erp-text)", marginBottom: "0.5rem" }}>
              Motorizados (Delivery)
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
              Crea y gestiona los usuarios de los motorizados encargados de las entregas.
            </p>
            <MotorizadosConfigClient />
          </div>
        </div>
      )}

      {tab === "alarmas" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Configura el sonido y comportamiento de las alarmas de Pedidos Pendientes.
          </p>
          <AlarmasConfigClient />
        </div>
      )}

      {tab === "configuracion" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Ajusta los parámetros generales del sistema.
          </p>
          <ConfiguracionClient />
        </div>
      )}

      {tab === "inventario" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Inicialización de operaciones: lleva el inventario de todos los productos a cero.
          </p>
          <InventarioInicialClient />
        </div>
      )}

      {tab === "acceso" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Administra el acceso de tu propia cuenta.
          </p>
          <AdminAccesoClient nombre={nombre} usuario={usuario} />
        </div>
      )}

      {tab === "llm" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Configura las API keys de Gemini y Groq. Gemini es el proveedor principal;
            Groq actúa como failback automático ante errores de cuota o disponibilidad.
          </p>
          <LLMAdminPanel />
        </div>
      )}

      {tab === "conteo" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Crea y gestiona los usuarios que realizan el conteo físico de inventario en{" "}
            <a href="/conteo" target="_blank" style={{ color: "var(--erp-primary)" }}>/conteo</a>.
          </p>
          <ConteoUsuariosConfigClient />
        </div>
      )}

      {tab === "gastos-config" && (
        <div>
          <TiposGastoConfigClient />
        </div>
      )}

      {tab === "centros-costo" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Gestiona las sucursales o centros de costo para asignar a Nóminas y Gastos.
          </p>
          <CentrosCostoConfigClient />
        </div>
      )}

      {tab === "cargos" && (
        <div>
          <p style={{ fontSize: "0.875rem", color: "var(--erp-text-2)", marginBottom: "1rem" }}>
            Gestiona los cargos y posiciones disponibles para asignar a los empleados.
          </p>
          <CargosConfigClient />
        </div>
      )}
    </div>
  );
}

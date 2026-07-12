"use client";

import { useEffect, useState, FormEvent } from "react";
import type { CuentaPorCobrarItem } from "@/lib/types";
import { ALARMAS_CONFIG_DEFAULT } from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";
import { alarmaVencimientoActiva, esCuentaVencida, proximaAlarmaVencimiento } from "@/lib/cuentasPorCobrar";

type EstadoFiltro = "TODOS" | "COBRADA" | "PENDIENTE";
type TipoFiltro = "TODOS" | "CASHEA" | "YUMMY" | "CxC Directa";

const TIPO_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  CASHEA:        { label: "Cashea",      bg: "#FEF9C3", color: "#854D0E" },
  YUMMY:         { label: "Yummy",       bg: "#DCFCE7", color: "#166534" },
  "CxC Directa": { label: "CxC Directa", bg: "var(--erp-primary-lt)", color: "var(--erp-primary)" },
};

export default function CuentasPorCobrarPanel() {
  const [items, setItems] = useState<CuentaPorCobrarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [vencimientoHora, setVencimientoHora] = useState(ALARMAS_CONFIG_DEFAULT.vencimientoHora);
  const [now, setNow] = useState(0);

  const [estado, setEstado] = useState<EstadoFiltro>("PENDIENTE");
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [ventaId, setVentaId] = useState("");
  const [cliente, setCliente] = useState("");

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (estado !== "TODOS") params.set("cobrada", estado);
      if (ventaId.trim()) params.set("ventaId", ventaId.trim());
      if (cliente.trim()) params.set("cliente", cliente.trim());

      const res = await fetch(`/api/reportes/cuentas-por-cobrar?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al cargar las cuentas por cobrar");
      }
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las cuentas por cobrar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/alarmas-config");
        if (res.ok) {
          const config = await res.json();
          setVencimientoHora(config.vencimientoHora);
        }
      } catch {
        // usar valor por defecto
      }
    }
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    loadItems();
  }

  async function handleToggleCobrada(item: CuentaPorCobrarItem) {
    setUpdatingId(item.ventaId);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/cuentas-por-cobrar/${item.ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuentaCobrada: !item.cuentaCobrada }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al actualizar el cobro");
      }
      setItems((prev) =>
        prev.map((it) =>
          it.ventaId === item.ventaId
            ? { ...it, cuentaCobrada: data.cuentaCobrada, cuentaCobradaAt: data.cuentaCobradaAt }
            : it
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el cobro");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSilenciarAlarma(item: CuentaPorCobrarItem) {
    setUpdatingId(item.ventaId);
    setError(null);
    try {
      const res = await fetch(`/api/reportes/cuentas-por-cobrar/${item.ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alarmaSilenciadaHasta: proximaAlarmaVencimiento(vencimientoHora) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al actualizar la alarma");
      }
      setItems((prev) =>
        prev.map((it) =>
          it.ventaId === item.ventaId
            ? { ...it, alarmaSilenciadaHasta: data.alarmaSilenciadaHasta }
            : it
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la alarma");
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = tipo === "TODOS" ? items : items.filter((it) => it.tipoCxC === tipo);
  const pendientes = filtered.filter((it) => !it.cuentaCobrada);
  const totalPendienteUsd = pendientes.reduce((a, it) => a + it.totalUsd, 0);
  const totalPendienteBs  = pendientes.reduce((a, it) => a + it.totalBs,  0);
  const totalUsd = filtered.reduce((a, it) => a + it.totalUsd, 0);
  const totalBs  = filtered.reduce((a, it) => a + it.totalBs,  0);

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <form
        onSubmit={handleSubmit}
        style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)" }}
        className="rounded-xl p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">Estado</label>
            <select
              style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
            >
              <option value="TODOS">Todos</option>
              <option value="COBRADA">Pagadas</option>
              <option value="PENDIENTE">Pendientes</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">Tipo</label>
            <select
              style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoFiltro)}
            >
              <option value="TODOS">Todos</option>
              <option value="CxC Directa">CxC Directa</option>
              <option value="CASHEA">Cashea</option>
              <option value="YUMMY">Yummy</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">N° de pedido</label>
            <input
              style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, width: 100 }}
              type="number"
              value={ventaId}
              onChange={(e) => setVentaId(e.target.value)}
              placeholder="Ej: 123"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">Cliente</label>
            <input
              style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14 }}
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--erp-primary)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Buscando..." : "Filtrar"}
          </button>
        </div>
      </form>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 16px", fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* KPI chips */}
      <div className="flex flex-wrap gap-3">
        <div
          style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12 }}
          className="px-4 py-3 text-sm"
        >
          <span style={{ color: "var(--erp-text-2)", fontWeight: 500 }}>Total: </span>
          <span style={{ color: "var(--erp-text)", fontWeight: 700 }}>{totalBs.toFixed(2)} Bs</span>
          <span style={{ color: "var(--erp-text-3)" }}> (${totalUsd.toFixed(2)})</span>
        </div>
        <div
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12 }}
          className="px-4 py-3 text-sm"
        >
          <span style={{ color: "#92400E", fontWeight: 500 }}>Pendiente: </span>
          <span style={{ color: "#78350F", fontWeight: 700 }}>{totalPendienteBs.toFixed(2)} Bs</span>
          <span style={{ color: "#B45309" }}> (${totalPendienteUsd.toFixed(2)})</span>
        </div>
      </div>

      {/* Tabla */}
      <div
        style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["Pedido #", "Fecha", "Cliente", "Teléfono", "Tipo", "Monto total", "Fecha límite", "Estado", "Acciones"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: h === "Monto total" ? "right" : h === "Estado" || h === "Acciones" ? "center" : "left",
                      color: "var(--erp-text-2)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--erp-border)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", color: "var(--erp-text-3)" }}>
                    No hay cuentas por cobrar que coincidan con los filtros
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", color: "var(--erp-text-3)" }}>
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((item, idx) => {
                  const badge = TIPO_BADGE[item.tipoCxC];
                  const vencida = esCuentaVencida(item, now);
                  const alarmaActiva = alarmaVencimientoActiva(item, now, vencimientoHora);
                  return (
                    <tr
                      key={item.ventaId}
                      style={{
                        borderBottom: idx < filtered.length - 1 ? "1px solid var(--erp-border)" : "none",
                        background: "var(--erp-surface)",
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--erp-text)", whiteSpace: "nowrap" }}>
                        #{item.ventaId}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                        {formatFecha(item.fecha)}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--erp-text)", whiteSpace: "nowrap" }}>
                        {item.cliente}
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                        {item.clienteTelefono ?? "-"}
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            borderRadius: 999,
                            padding: "2px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap", color: "var(--erp-text)", fontVariantNumeric: "tabular-nums" }}>
                        <span style={{ fontWeight: 700 }}>{item.totalBs.toFixed(2)} Bs</span>
                        <span style={{ color: "var(--erp-text-3)", marginLeft: 4 }}>(${item.totalUsd.toFixed(2)})</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                        {item.fechaLimitePago ? formatFecha(item.fechaLimitePago) : "-"}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {item.cuentaCobrada ? (
                          <span style={{ background: "#DCFCE7", color: "#166534", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                            Pagada
                          </span>
                        ) : (
                          <span style={{ background: "#FEF9C3", color: "#854D0E", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          {vencida && (
                            <button
                              type="button"
                              onClick={() => handleSilenciarAlarma(item)}
                              disabled={updatingId === item.ventaId}
                              title={
                                alarmaActiva
                                  ? "Plazo vencido: clic para silenciar la alarma"
                                  : "Alarma silenciada hasta el próximo aviso"
                              }
                              style={{
                                background: alarmaActiva ? "var(--erp-accent)" : "var(--erp-border)",
                                color: alarmaActiva ? "#fff" : "var(--erp-text-3)",
                                border: "none",
                                borderRadius: 999,
                                padding: "4px 8px",
                                fontSize: 12,
                                cursor: "pointer",
                                opacity: updatingId === item.ventaId ? 0.5 : 1,
                              }}
                            >
                              🔔
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleCobrada(item)}
                            disabled={updatingId === item.ventaId}
                            style={{
                              background: "transparent",
                              border: "1px solid var(--erp-border)",
                              borderRadius: 8,
                              padding: "4px 12px",
                              fontSize: 12,
                              fontWeight: 500,
                              color: "var(--erp-text-2)",
                              cursor: "pointer",
                              opacity: updatingId === item.ventaId ? 0.5 : 1,
                            }}
                          >
                            {item.cuentaCobrada ? "Marcar pendiente" : "Marcar pagada"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

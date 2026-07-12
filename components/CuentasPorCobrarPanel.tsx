"use client";

import { useEffect, useState } from "react";
import { formatFecha } from "@/lib/pedidos";

type TipoCxC = "CxC Directa" | "CASHEA" | "YUMMY";
type EstadoFiltro = "TODOS" | "PENDIENTE" | "COBRADA";
type TipoFiltro = "TODOS" | "CxC Directa" | "CASHEA" | "YUMMY";

type UnifiedItem = {
  ventaId: number;
  fecha: string;
  cliente: string;
  clienteTelefono: string | null;
  totalUsd: number;
  totalBs: number;
  pendiente: boolean;       // !cuentaCobrada or !liquidado
  tipoCxC: TipoCxC;
  fechaVencimiento: string | null;
};

const TIPO_BADGE: Record<TipoCxC, { label: string; bg: string; color: string }> = {
  CASHEA:        { label: "Cashea",      bg: "#FEF9C3", color: "#854D0E" },
  YUMMY:         { label: "Yummy",       bg: "#DCFCE7", color: "#166534" },
  "CxC Directa": { label: "CxC Directa", bg: "var(--erp-primary-lt)", color: "var(--erp-primary)" },
};

export default function CuentasPorCobrarPanel() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [estado, setEstado] = useState<EstadoFiltro>("PENDIENTE");
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [clienteQ, setClienteQ] = useState("");

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const [cxcRes, casheaRes, yummyRes] = await Promise.all([
        fetch("/api/reportes/cuentas-por-cobrar"),
        fetch("/api/reportes/cashea"),
        fetch("/api/reportes/yummy"),
      ]);

      const [cxcData, casheaData, yummyData] = await Promise.all([
        cxcRes.json(),
        casheaRes.json(),
        yummyRes.json(),
      ]);

      if (!cxcRes.ok) throw new Error(cxcData.error ?? "Error al cargar CxC");

      const directas: UnifiedItem[] = (cxcData.items ?? []).map((it: {
        ventaId: number; fecha: string; cliente: string; clienteTelefono: string | null;
        totalUsd: number; totalBs: number; cuentaCobrada: boolean; fechaLimitePago: string | null;
      }) => ({
        ventaId: it.ventaId,
        fecha: it.fecha,
        cliente: it.cliente,
        clienteTelefono: it.clienteTelefono,
        totalUsd: it.totalUsd,
        totalBs: it.totalBs,
        pendiente: !it.cuentaCobrada,
        tipoCxC: "CxC Directa" as TipoCxC,
        fechaVencimiento: it.fechaLimitePago,
      }));

      const casheas: UnifiedItem[] = (casheaData.items ?? []).map((it: {
        ventaId: number; fecha: string; cliente: string;
        montoInicial: number; montoFinanciado: number; tasaDelDia: number;
        liquidado: boolean; fechaVencimiento: string;
      }) => {
        const totalUsd = it.montoInicial + it.montoFinanciado;
        return {
          ventaId: it.ventaId,
          fecha: it.fecha,
          cliente: it.cliente,
          clienteTelefono: null,
          totalUsd,
          totalBs: totalUsd * it.tasaDelDia,
          pendiente: !it.liquidado,
          tipoCxC: "CASHEA" as TipoCxC,
          fechaVencimiento: it.fechaVencimiento,
        };
      });

      const yummies: UnifiedItem[] = (yummyData.items ?? []).map((it: {
        ventaId: number; fecha: string; cliente: string;
        monto: number; liquidado: boolean; fechaVencimiento: string;
      }) => ({
        ventaId: it.ventaId,
        fecha: it.fecha,
        cliente: it.cliente,
        clienteTelefono: null,
        totalUsd: it.monto,
        totalBs: 0,
        pendiente: !it.liquidado,
        tipoCxC: "YUMMY" as TipoCxC,
        fechaVencimiento: it.fechaVencimiento,
      }));

      const all = [...directas, ...casheas, ...yummies].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );
      setItems(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar las cuentas por cobrar");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(item: UnifiedItem) {
    setUpdatingId(item.ventaId);
    setError(null);
    try {
      let res: Response;
      if (item.tipoCxC === "CASHEA") {
        res = await fetch(`/api/reportes/cashea/${item.ventaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liquidado: item.pendiente }),
        });
      } else if (item.tipoCxC === "YUMMY") {
        res = await fetch(`/api/reportes/yummy/${item.ventaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liquidado: item.pendiente }),
        });
      } else {
        res = await fetch(`/api/reportes/cuentas-por-cobrar/${item.ventaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuentaCobrada: item.pendiente }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al actualizar");
      setItems((prev) =>
        prev.map((it) =>
          it.ventaId === item.ventaId && it.tipoCxC === item.tipoCxC
            ? { ...it, pendiente: !item.pendiente }
            : it
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setUpdatingId(null);
    }
  }

  // Filtros en cliente
  const filtered = items.filter((it) => {
    if (estado === "PENDIENTE" && !it.pendiente) return false;
    if (estado === "COBRADA" && it.pendiente) return false;
    if (tipo !== "TODOS" && it.tipoCxC !== tipo) return false;
    if (clienteQ && !it.cliente.toLowerCase().includes(clienteQ.toLowerCase())) return false;
    return true;
  });

  // KPIs sobre todos los items (sin filtro de estado)
  const pendientesTodos = items.filter((it) => it.pendiente);
  const kpiTotal = pendientesTodos.reduce((a, it) => a + it.totalUsd, 0);
  const kpiCashea = pendientesTodos.filter((it) => it.tipoCxC === "CASHEA");
  const kpiYummy  = pendientesTodos.filter((it) => it.tipoCxC === "YUMMY");
  const kpiDirecta = pendientesTodos.filter((it) => it.tipoCxC === "CxC Directa");

  return (
    <div className="flex flex-col gap-4">
      {/* KPI cards */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total pendiente", value: kpiTotal, count: pendientesTodos.length, color: "var(--erp-primary)" },
            { label: "Cashea pendiente", value: kpiCashea.reduce((a, it) => a + it.totalUsd, 0), count: kpiCashea.length, color: "#A855F7" },
            { label: "Yummy pendiente",  value: kpiYummy.reduce((a, it) => a + it.totalUsd, 0),  count: kpiYummy.length,  color: "#16A34A" },
            { label: "CxC Directa",      value: kpiDirecta.reduce((a, it) => a + it.totalUsd, 0), count: kpiDirecta.length, color: "var(--erp-accent)" },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderTop: `3px solid ${kpi.color}`, borderRadius: 12 }} className="p-4">
              <div style={{ color: "var(--erp-text-3)", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ color: kpi.color, fontSize: 22, fontWeight: 800 }}>${kpi.value.toFixed(0)}</div>
              <div style={{ color: "var(--erp-text-3)", fontSize: 11, marginTop: 4 }}>{kpi.count} cuentas</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12 }} className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">Estado</label>
            <select style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14 }} value={estado} onChange={(e) => setEstado(e.target.value as EstadoFiltro)}>
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="COBRADA">Pagadas</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">Tipo</label>
            <select style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14 }} value={tipo} onChange={(e) => setTipo(e.target.value as TipoFiltro)}>
              <option value="TODOS">Todos</option>
              <option value="CxC Directa">CxC Directa</option>
              <option value="CASHEA">Cashea</option>
              <option value="YUMMY">Yummy</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)" }} className="text-xs font-medium">Cliente</label>
            <input style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14 }} value={clienteQ} onChange={(e) => setClienteQ(e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <button
            type="button"
            onClick={loadItems}
            disabled={loading}
            style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 16px", fontSize: 13 }}>{error}</div>
      )}

      {/* Tabla */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["Pedido #", "Fecha", "Cliente", "Tipo", "Monto total", "Vencimiento", "Estado", "Acciones"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: h === "Monto total" ? "right" : h === "Estado" || h === "Acciones" ? "center" : "left", color: "var(--erp-text-2)", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--erp-border)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: "var(--erp-text-3)" }}>Cargando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", color: "var(--erp-text-3)" }}>No hay cuentas que coincidan con los filtros</td></tr>
              )}
              {!loading && filtered.map((item, idx) => {
                const badge = TIPO_BADGE[item.tipoCxC];
                const isUpdating = updatingId === item.ventaId;
                return (
                  <tr key={`${item.tipoCxC}-${item.ventaId}`} style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--erp-border)" : "none", background: "var(--erp-surface)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--erp-text)", whiteSpace: "nowrap" }}>#{item.ventaId}</td>
                    <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{formatFecha(item.fecha)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--erp-text)", whiteSpace: "nowrap" }}>{item.cliente}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontWeight: 700, color: "var(--erp-text)" }}>${item.totalUsd.toFixed(2)}</span>
                      {item.totalBs > 0 && <span style={{ color: "var(--erp-text-3)", marginLeft: 4, fontSize: 11 }}>Bs {item.totalBs.toFixed(0)}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                      {item.fechaVencimiento ? formatFecha(item.fechaVencimiento) : "-"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {item.pendiente ? (
                        <span style={{ background: "#FEF9C3", color: "#854D0E", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Pendiente</span>
                      ) : (
                        <span style={{ background: "#DCFCE7", color: "#166534", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Pagada</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => handleToggle(item)}
                        disabled={isUpdating}
                        style={{ background: "transparent", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 500, color: "var(--erp-text-2)", cursor: "pointer", opacity: isUpdating ? 0.5 : 1 }}
                      >
                        {item.pendiente ? "Marcar pagada" : "Marcar pendiente"}
                      </button>
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

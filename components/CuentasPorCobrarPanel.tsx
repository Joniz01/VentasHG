"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { formatFecha } from "@/lib/pedidos";

type TipoCxC = "CxC Directa" | "CASHEA" | "YUMMY";
type EstadoFiltro = "TODOS" | "PENDIENTE" | "COBRADA" | "VENCIDA";
const CXC_DISMISSED_KEY = "cxc_alerta_dismissed_day";
type TipoFiltro = "TODOS" | "CxC Directa" | "CASHEA" | "YUMMY";

type UnifiedItem = {
  ventaId: number;
  fecha: string;
  cliente: string;
  clienteTelefono: string | null;
  totalUsd: number;
  totalBs: number;
  pendiente: boolean;
  tipoCxC: TipoCxC;
  fechaVencimiento: string | null;
};

const TIPO_BADGE: Record<TipoCxC, { label: string; bg: string; color: string; dot: string }> = {
  CASHEA:        { label: "Cashea",      bg: "#FEF9C3", color: "#854D0E", dot: "#A855F7" },
  YUMMY:         { label: "Yummy",       bg: "#DCFCE7", color: "#166534", dot: "#16A34A" },
  "CxC Directa": { label: "CxC Directa", bg: "var(--erp-primary-lt)", color: "var(--erp-primary)", dot: "var(--erp-primary)" },
};

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfWeek(d: Date) {
  const day = new Date(d);
  const diff = day.getDay() === 0 ? 6 : day.getDay() - 1;
  day.setDate(day.getDate() - diff);
  return day;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function CuentasPorCobrarPanel() {
  const searchParams = useSearchParams();
  const soloVencidas = searchParams.get("filtro") === "vencidas";

  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const hoyIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [estado, setEstado] = useState<EstadoFiltro>(soloVencidas ? "VENCIDA" : "PENDIENTE");
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [clienteQ, setClienteQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Registrar visita para suprimir alertas el resto del día
  useEffect(() => {
    try { localStorage.setItem(CXC_DISMISSED_KEY, hoyIso); } catch { /* ignorar */ }
    // Disparar evento para que ShellBar y SidebarNav se actualicen
    window.dispatchEvent(new CustomEvent("cxc-visited"));
  }, [hoyIso]);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const cxcParams = new URLSearchParams();
      if (desde) cxcParams.set("desde", desde);
      if (hasta) cxcParams.set("hasta", hasta);

      const casheaParams = new URLSearchParams();
      const yummyParams = new URLSearchParams();

      const [cxcRes, casheaRes, yummyRes] = await Promise.all([
        fetch(`/api/reportes/cuentas-por-cobrar?${cxcParams}`),
        fetch(`/api/reportes/cashea?${casheaParams}`),
        fetch(`/api/reportes/yummy?${yummyParams}`),
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
        // El inicial ya se cobró al momento de la venta (queda reflejado como
        // ingreso por su forma de pago); lo único pendiente de cobrar es el
        // monto financiado.
        const totalUsd = it.montoFinanciado;
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

      // Filtra por rango de fecha si aplica (cashea/yummy por fecha de venta)
      const inRange = (fecha: string) => {
        if (!desde && !hasta) return true;
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        return true;
      };

      const all = [
        ...directas,
        ...casheas.filter((it) => inRange(it.fecha)),
        ...yummies.filter((it) => inRange(it.fecha)),
      ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

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

  function handleSemana() {
    const hoy = new Date();
    setDesde(toIso(startOfWeek(hoy)));
    setHasta(toIso(hoy));
  }
  function handleMes() {
    const hoy = new Date();
    setDesde(toIso(startOfMonth(hoy)));
    setHasta(toIso(hoy));
  }
  function handleLimpiar() {
    setDesde("");
    setHasta("");
    setEstado("PENDIENTE");
    setTipo("TODOS");
    setClienteQ("");
  }

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
    if (estado === "VENCIDA") {
      if (!it.pendiente) return false;
      if (!it.fechaVencimiento || it.fechaVencimiento >= hoyIso) return false;
    }
    if (tipo !== "TODOS" && it.tipoCxC !== tipo) return false;
    if (clienteQ && !it.cliente.toLowerCase().includes(clienteQ.toLowerCase())) return false;
    return true;
  });

  // Conteos para los chips (sobre el estado seleccionado, sin filtro de tipo)
  const filteredForCount = items.filter((it) => {
    if (estado === "PENDIENTE" && !it.pendiente) return false;
    if (estado === "COBRADA" && it.pendiente) return false;
    if (clienteQ && !it.cliente.toLowerCase().includes(clienteQ.toLowerCase())) return false;
    return true;
  });
  const countTodos   = filteredForCount.length;
  const countCashea  = filteredForCount.filter((it) => it.tipoCxC === "CASHEA").length;
  const countYummy   = filteredForCount.filter((it) => it.tipoCxC === "YUMMY").length;
  const countDirecta = filteredForCount.filter((it) => it.tipoCxC === "CxC Directa").length;

  // KPIs sobre todos los items pendientes
  const pendientesTodos = items.filter((it) => it.pendiente);
  const kpiTotal   = pendientesTodos.reduce((a, it) => a + it.totalUsd, 0);
  const kpiCashea  = pendientesTodos.filter((it) => it.tipoCxC === "CASHEA");
  const kpiYummy   = pendientesTodos.filter((it) => it.tipoCxC === "YUMMY");
  const kpiDirecta = pendientesTodos.filter((it) => it.tipoCxC === "CxC Directa");

  const chipBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
    cursor: "pointer", border: "1px solid var(--erp-border)",
    background: "var(--erp-surface)", color: "var(--erp-text-2)",
    transition: "all 0.15s",
  };
  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: "var(--erp-primary)", color: "#fff",
    border: "1px solid var(--erp-primary)",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Banner de filtro vencidas */}
      {(soloVencidas || estado === "VENCIDA") && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.65rem 1rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🔴</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#b91c1c" }}>
            Mostrando solo cuentas por cobrar <strong>vencidas</strong> — fecha de vencimiento superada y pendientes de pago.
          </span>
        </div>
      )}
      {/* KPI cards */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total pendiente", value: kpiTotal,   count: pendientesTodos.length, color: "var(--erp-primary)" },
            { label: "Cashea",          value: kpiCashea.reduce((a, it) => a + it.totalUsd, 0),  count: kpiCashea.length,  color: "#A855F7" },
            { label: "Yummy",           value: kpiYummy.reduce((a, it) => a + it.totalUsd, 0),   count: kpiYummy.length,   color: "#16A34A" },
            { label: "CxC Directa",     value: kpiDirecta.reduce((a, it) => a + it.totalUsd, 0), count: kpiDirecta.length, color: "var(--erp-accent)" },
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
      <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12 }} className="p-4 flex flex-col gap-3">
        {/* Fila 1: fechas + estado + cliente */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Desde</label>
            <input type="date" style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", color: "var(--erp-text)" }} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Hasta</label>
            <input type="date" style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", color: "var(--erp-text)" }} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Estado</label>
            <select style={{ borderColor: "var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, border: "1px solid var(--erp-border)", background: "var(--erp-surface)", color: "var(--erp-text)" }} value={estado} onChange={(e) => setEstado(e.target.value as EstadoFiltro)}>
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="COBRADA">Pagadas</option>
              <option value="VENCIDA">⚠️ Vencidas</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ color: "var(--erp-text-2)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Cliente</label>
            <input style={{ border: "1px solid var(--erp-border)", borderRadius: 8, padding: "6px 10px", fontSize: 14, background: "var(--erp-surface)", color: "var(--erp-text)" }} value={clienteQ} onChange={(e) => setClienteQ(e.target.value)} placeholder="Buscar cliente" />
          </div>
        </div>
        {/* Fila 2: accesos rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSemana} style={{ ...chipBase, fontSize: 12 }}>Esta semana</button>
          <button type="button" onClick={handleMes}    style={{ ...chipBase, fontSize: 12 }}>Este mes</button>
          <button type="button" onClick={loadItems} disabled={loading} style={{ background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Cargando..." : "Buscar"}
          </button>
          <button type="button" onClick={handleLimpiar} style={{ ...chipBase, fontSize: 12 }}>✕ Limpiar</button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 8, padding: "10px 16px", fontSize: 13 }}>{error}</div>
      )}

      {/* Chips de tipo */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "TODOS",       label: `Todos (${countTodos})`,           dot: null },
          { key: "CASHEA",      label: `Cashea (${countCashea})`,         dot: "#A855F7" },
          { key: "YUMMY",       label: `Yummy (${countYummy})`,           dot: "#16A34A" },
          { key: "CxC Directa", label: `CxC Directa (${countDirecta})`,   dot: "var(--erp-primary)" },
        ] as { key: TipoFiltro; label: string; dot: string | null }[]).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setTipo(chip.key)}
            style={tipo === chip.key ? chipActive : chipBase}
          >
            {chip.dot && <span style={{ width: 8, height: 8, borderRadius: "50%", background: chip.dot, display: "inline-block", flexShrink: 0 }} />}
            {chip.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div style={{ border: "1px solid var(--erp-border)", borderRadius: 12, overflow: "hidden", background: "var(--erp-surface)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--erp-bg)" }}>
                {["#Venta", "Fecha", "Cliente", "Tipo", "Monto $", "Vencimiento", "Estado", "Acciones"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: h === "Monto $" ? "right" : h === "Estado" || h === "Acciones" ? "center" : "left", color: "var(--erp-text-2)", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--erp-border)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--erp-primary)", whiteSpace: "nowrap" }}>#{item.ventaId}</td>
                    <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{formatFecha(item.fecha)}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--erp-text)", whiteSpace: "nowrap" }}>{item.cliente}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ background: badge.bg, color: badge.color, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ fontWeight: 700, color: "var(--erp-text)" }}>${item.totalUsd.toFixed(2)}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>
                      {item.fechaVencimiento ? formatFecha(item.fechaVencimiento) : "-"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {item.pendiente
                        ? <span style={{ background: "#FEF9C3", color: "#854D0E", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Pendiente</span>
                        : <span style={{ background: "#DCFCE7", color: "#166534", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Pagada</span>
                      }
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => handleToggle(item)} disabled={isUpdating} style={{ background: "transparent", border: "1px solid var(--erp-border)", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 500, color: "var(--erp-text-2)", cursor: "pointer", opacity: isUpdating ? 0.5 : 1 }}>
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

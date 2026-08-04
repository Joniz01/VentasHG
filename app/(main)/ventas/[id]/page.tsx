import { notFound } from "next/navigation";
import Link from "next/link";
import { pool } from "@/lib/db";
import { METODO_PAGO_LABELS, METODOS_PAGO_USD } from "@/lib/types";
import type { MetodoPago } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function getVentaDetalle(id: string) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  const ventaResult = await pool.query(
    `SELECT v.id, v.fecha, v.tasa_dia, v.cliente, v.cliente_ci, v.cliente_telefono,
            v.direccion, v.modalidad_compra, v.modo_entrega, v.tipo_delivery,
            v.costo_delivery, v.descuento_porcentaje, v.observaciones,
            v.despacho_pendiente, v.hora_entrega, v.hora_preparacion, v.hora_retiro,
            v.delivery_asignado, v.cuenta_por_cobrar, v.cuenta_cobrada,
            v.cuenta_cobrada_at, v.fecha_limite_pago,
            m.nombre AS motorizado_nombre
     FROM ventas v
     LEFT JOIN motorizados m ON m.id = v.motorizado_id
     WHERE v.id = $1`,
    [numId]
  );

  if (ventaResult.rowCount === 0) return null;
  const v = ventaResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT vi.cantidad, vi.precio_unit, vi.costo_unit, p.nombre AS producto,
            e.nombre AS extra
     FROM venta_items vi
     JOIN productos p ON p.id = vi.producto_id
     LEFT JOIN productos e ON e.id = vi.extra_id
     WHERE vi.venta_id = $1
     ORDER BY vi.id`,
    [numId]
  );

  const pagosResult = await pool.query(
    `SELECT metodo, monto, COALESCE(fecha_pago, $2) AS fecha_pago
     FROM pagos_venta
     WHERE venta_id = $1
     ORDER BY id`,
    [numId, v.fecha]
  );

  return {
    venta: {
      id: v.id,
      fecha: v.fecha,
      tasaDia: Number(v.tasa_dia),
      cliente: v.cliente,
      clienteCi: v.cliente_ci as string | null,
      clienteTelefono: v.cliente_telefono as string | null,
      direccion: v.direccion as string | null,
      modoEntrega: v.modo_entrega as string,
      tipoDelivery: v.tipo_delivery as string | null,
      costoDelivery: Number(v.costo_delivery),
      descuentoPorcentaje: Number(v.descuento_porcentaje),
      observaciones: v.observaciones as string | null,
      horaEntrega: v.hora_entrega as string | null,
      horaPreparacion: v.hora_preparacion as string | null,
      horaRetiro: v.hora_retiro as string | null,
      deliveryAsignado: v.delivery_asignado as string | null,
      motorizadoNombre: v.motorizado_nombre as string | null,
      cuentaPorCobrar: v.cuenta_por_cobrar as boolean,
      cuentaCobrada: v.cuenta_cobrada as boolean,
      cuentaCobradaAt: v.cuenta_cobrada_at as string | null,
      fechaLimitePago: v.fecha_limite_pago as string | null,
    },
    items: itemsResult.rows.map((r) => ({
      producto: r.producto as string,
      extra: r.extra as string | null,
      cantidad: Number(r.cantidad),
      precioUnit: Number(r.precio_unit),
    })),
    pagos: pagosResult.rows.map((r) => ({
      metodo: r.metodo as string,
      monto: Number(r.monto),
    })),
  };
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString("es-VE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default async function VentaDetallePage({ params }: Params) {
  const { id } = await params;
  const data = await getVentaDetalle(id);
  if (!data) notFound();

  const { venta, items, pagos } = data;

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);
  const descuento = subtotal * (venta.descuentoPorcentaje / 100);
  const totalUsd = subtotal - descuento + venta.costoDelivery;
  const totalBs = totalUsd * venta.tasaDia;

  const totalPagadoUsd = pagos.reduce((s, p) => {
    const esUsd = (METODOS_PAGO_USD as readonly string[]).includes(p.metodo);
    return s + (esUsd ? p.monto : p.monto / venta.tasaDia);
  }, 0);

  const fechaStr = new Date(venta.fecha).toLocaleDateString("es-VE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--erp-text)" }}>
            Pedido #{venta.id}
          </h1>
          <p className="text-xs capitalize" style={{ color: "var(--erp-text-3)" }}>{fechaStr}</p>
        </div>
        <Link
          href="/reportes"
          className="text-xs px-3 py-1.5 rounded-lg border"
          style={{ color: "var(--erp-text-2)", borderColor: "var(--erp-border)" }}
        >
          ← Volver a Reportes
        </Link>
      </div>

      {/* Cliente */}
      <Section title="Cliente">
        <Row label="Nombre" value={venta.cliente} />
        {venta.clienteCi && <Row label="C.I." value={venta.clienteCi} />}
        {venta.clienteTelefono && <Row label="Teléfono" value={venta.clienteTelefono} />}
        {venta.direccion && <Row label="Dirección" value={venta.direccion} />}
      </Section>

      {/* Entrega */}
      <Section title="Entrega">
        <Row label="Modo" value={venta.modoEntrega === "DELIVERY" ? "Delivery" : "Retiro en local"} />
        {venta.tipoDelivery && <Row label="Tipo" value={venta.tipoDelivery} />}
        {venta.motorizadoNombre && <Row label="Motorizado" value={venta.motorizadoNombre} />}
        {venta.deliveryAsignado && <Row label="Plataforma" value={venta.deliveryAsignado} />}
        {venta.horaEntrega && <Row label="Hora entrega" value={venta.horaEntrega} />}
        {venta.horaPreparacion && <Row label="Hora preparación" value={venta.horaPreparacion} />}
        {venta.horaRetiro && <Row label="Hora retiro" value={venta.horaRetiro} />}
        {venta.observaciones && <Row label="Observaciones" value={venta.observaciones} />}
      </Section>

      {/* Items */}
      <Section title="Productos">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: "var(--erp-text-3)" }}>
                <th className="text-left pb-2 font-semibold">Producto</th>
                <th className="text-right pb-2 font-semibold">Cant.</th>
                <th className="text-right pb-2 font-semibold">P. Unit $</th>
                <th className="text-right pb-2 font-semibold">Total $</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--erp-border)" }}>
                  <td className="py-1.5 pr-2" style={{ color: "var(--erp-text)" }}>
                    {item.producto}
                    {item.extra && (
                      <span className="ml-1" style={{ color: "var(--erp-text-3)" }}>
                        + {item.extra}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--erp-text-2)" }}>
                    {item.cantidad}
                  </td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: "var(--erp-text-2)" }}>
                    {fmt(item.precioUnit)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium" style={{ color: "var(--erp-text)" }}>
                    {fmt(item.cantidad * item.precioUnit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 space-y-1 text-xs" style={{ borderTop: "1px solid var(--erp-border)", paddingTop: "10px" }}>
          <TotalRow label="Subtotal" value={`$${fmt(subtotal)}`} />
          {venta.descuentoPorcentaje > 0 && (
            <TotalRow label={`Descuento (${venta.descuentoPorcentaje}%)`} value={`-$${fmt(descuento)}`} accent />
          )}
          {venta.costoDelivery > 0 && (
            <TotalRow label="Delivery" value={`$${fmt(venta.costoDelivery)}`} />
          )}
          <TotalRow label="Tasa del día" value={`Bs ${fmt(venta.tasaDia, 2)}`} />
          <TotalRow label="Total USD" value={`$${fmt(totalUsd)}`} bold />
          <TotalRow label="Total Bs" value={`Bs ${fmt(totalBs, 0)}`} bold />
        </div>
      </Section>

      {/* Pagos */}
      <Section title="Pagos">
        <div className="space-y-1.5">
          {pagos.map((p, i) => {
            const esUsd = (METODOS_PAGO_USD as readonly string[]).includes(p.metodo);
            const label = METODO_PAGO_LABELS[p.metodo as MetodoPago] ?? p.metodo;
            const montoUsd = esUsd ? p.monto : p.monto / venta.tasaDia;
            const montoBs = esUsd ? p.monto * venta.tasaDia : p.monto;
            return (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg"
                style={{ background: "var(--erp-bg)" }}
              >
                <span style={{ color: "var(--erp-text-2)" }}>{label}</span>
                <span className="tabular-nums font-medium" style={{ color: "var(--erp-text)" }}>
                  ${fmt(montoUsd)} · Bs {fmt(montoBs, 0)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold px-2" style={{ color: "var(--erp-text)" }}>
          <span>Total pagado</span>
          <span className="tabular-nums">${fmt(totalPagadoUsd)}</span>
        </div>

        {venta.cuentaPorCobrar && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-xs"
            style={{
              background: venta.cuentaCobrada ? "#DCFCE7" : "#FEF9C3",
              color: venta.cuentaCobrada ? "#15803D" : "#92400E",
            }}
          >
            {venta.cuentaCobrada
              ? `✓ CxC cobrada el ${new Date(venta.cuentaCobradaAt!).toLocaleDateString("es-VE")}`
              : `⏳ Cuenta por cobrar${venta.fechaLimitePago ? ` · Vence ${new Date(venta.fechaLimitePago).toLocaleDateString("es-VE")}` : ""}`}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4 space-y-2"
      style={{ background: "var(--erp-surface)", borderColor: "var(--erp-border)" }}
    >
      <h2
        className="text-[10px] font-bold uppercase tracking-widest mb-3"
        style={{ color: "var(--erp-text-3)" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs gap-4">
      <span style={{ color: "var(--erp-text-3)" }}>{label}</span>
      <span className="text-right" style={{ color: "var(--erp-text)" }}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: accent ? "#DC2626" : "var(--erp-text-2)", fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span
        className="tabular-nums"
        style={{ color: accent ? "#DC2626" : "var(--erp-text)", fontWeight: bold ? 700 : 400 }}
      >
        {value}
      </span>
    </div>
  );
}

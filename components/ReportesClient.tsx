"use client";

import { FormEvent, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ReporteVentas } from "@/lib/types";
import { METODO_PAGO_LABELS } from "@/lib/types";
import DeliveryPagosPanel from "@/components/DeliveryPagosPanel";
import CuentasPorCobrarPanel from "@/components/CuentasPorCobrarPanel";

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export default function ReportesClient() {
  const searchParams = useSearchParams();
  const tabInicial = searchParams.get("tab");
  const [tab, setTab] = useState<"ventas" | "deliveries" | "cuentasPorCobrar">(
    tabInicial === "cuentasPorCobrar" || tabInicial === "deliveries" ? tabInicial : "ventas"
  );
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mesEspecifico, setMesEspecifico] = useState("");
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePendientes, setIncludePendientes] = useState(false);
  const [imagenPunto, setImagenPunto] = useState<string | null>(null);
  const [imagenExpandida, setImagenExpandida] = useState(false);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const reporteRef = useRef<HTMLDivElement>(null);
  const inputImagenRef = useRef<HTMLInputElement>(null);

  function compartirWhatsApp() {
    if (!reporte) return;
    const empresa = process.env.NEXT_PUBLIC_EMPRESA_NOMBRE ?? "";
    const fecha = reporte.desde === reporte.hasta ? reporte.desde : `${reporte.desde} al ${reporte.hasta}`;
    const url = `${window.location.origin}/reportes/vista?desde=${reporte.desde}&hasta=${reporte.hasta}`;
    const lineas = [
      empresa ? `*${empresa}*` : null,
      `📊 *Reporte de Ventas*`,
      `📅 ${fecha}`,
      ``,
      `💰 *Total: $${reporte.totalVentasUsd.toFixed(2)}* (${reporte.cantidadVentas} ${reporte.cantidadVentas === 1 ? "venta" : "ventas"})`,
      ``,
      `*Por forma de pago:*`,
      ...reporte.porFormaPago
        .filter((fp) => fp.totalUsd > 0)
        .map((fp) => `• ${METODO_PAGO_LABELS[fp.metodo]}: $${fp.totalUsd.toFixed(2)} / Bs ${fp.totalBs.toFixed(2)}`),
      ``,
      url,
    ].filter((l) => l !== null);
    const texto = lineas.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  async function descargarImagen() {
    if (!reporteRef.current) return;
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(reporteRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        allowTaint: true,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `reporte-ventas-${reporte?.desde ?? "hoy"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("No se pudo generar la imagen. Intente usar el enlace limpio para guardar.");
    }
  }

  function cargarImagenPunto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setImagenPunto(data);
      setImagenExpandida(false);
      try { localStorage.setItem("reporte_imagen_punto", data); } catch {}
    };
    reader.readAsDataURL(file);
  }

  function compartirWhatsAppConImagen() {
    const texto = `📊 *Reporte de Ventas*\n💰 Total: $${reporte?.totalVentasUsd.toFixed(2)} (${reporte?.cantidadVentas} ventas)\n\n_Adjunta la imagen del punto de venta_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  function copiarEnlace() {
    if (!reporte) return;
    const url = `${window.location.origin}/reportes/vista?desde=${reporte.desde}&hasta=${reporte.hasta}`;
    navigator.clipboard.writeText(url).then(() => {
      setEnlaceCopiado(true);
      setTimeout(() => setEnlaceCopiado(false), 2000);
    });
  }

  async function generar(desdeParam: string, hastaParam: string) {
    setError(null);
    setLoading(true);
    setDesde(desdeParam);
    setHasta(hastaParam);
    try {
      const res = await fetch(
        `/api/reportes?desde=${desdeParam}&hasta=${hastaParam}${includePendientes ? "&pendientes=1" : ""}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al generar el reporte");
      }
      setReporte(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el reporte");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  function handleHoy() {
    setMesEspecifico("");
    const hoy = toIsoDate(new Date());
    generar(hoy, hoy);
  }

  function handleSemana() {
    setMesEspecifico("");
    const hoy = new Date();
    generar(toIsoDate(startOfWeek(hoy)), toIsoDate(hoy));
  }

  function handleMes() {
    setMesEspecifico("");
    const hoy = new Date();
    generar(toIsoDate(startOfMonth(hoy)), toIsoDate(hoy));
  }

  function handleMesEspecifico(value: string) {
    setMesEspecifico(value);
    if (!value) return;

    const [year, month] = value.split("-").map(Number);
    const inicio = new Date(year, month - 1, 1);
    const fin = new Date(year, month, 0);
    generar(toIsoDate(inicio), toIsoDate(fin));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!desde || !hasta) {
      setError("Selecciona el rango de fechas");
      return;
    }
    setMesEspecifico("");
    generar(desde, hasta);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setTab("ventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "ventas"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Ventas
        </button>
        <button
          type="button"
          onClick={() => setTab("deliveries")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "deliveries"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Pagos a Delivery
        </button>
        <button
          type="button"
          onClick={() => setTab("cuentasPorCobrar")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "cuentasPorCobrar"
              ? "border-b-2 border-zinc-900 text-zinc-900"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          Ventas por Cobrar
        </button>
      </div>

      {tab === "deliveries" && <DeliveryPagosPanel />}

      {tab === "cuentasPorCobrar" && <CuentasPorCobrarPanel />}

      {tab === "ventas" && (
      <>
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={handleHoy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleSemana}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={handleMes}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Este mes
          </button>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">Mes específico</label>
            <input
              type="month"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              value={mesEspecifico}
              onChange={(e) => handleMesEspecifico(e.target.value)}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Desde</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Hasta</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Generar reporte
          </button>
          <label className="flex items-center gap-2 text-sm text-zinc-700 self-end pb-2">
            <input
              type="checkbox"
              checked={includePendientes}
              onChange={(e) => setIncludePendientes(e.target.checked)}
            />
            Mostrar ventas pendientes por pagar
          </label>
        </form>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && <div className="text-sm text-zinc-500">Generando reporte...</div>}

      {reporte && !loading && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={compartirWhatsApp}
              className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button
              type="button"
              onClick={descargarImagen}
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
            >
              📥 Descargar imagen
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => inputImagenRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
              >
                🖼️ Imagen punto de venta
              </button>
              {imagenPunto && (
                <button
                  type="button"
                  onClick={() => setImagenExpandida((v) => !v)}
                  title={imagenExpandida ? "Contraer imagen" : "Ver imagen"}
                  className="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-300 text-base hover:bg-zinc-100"
                >
                  {imagenExpandida ? "◆" : "◇"}
                </button>
              )}
            </div>
            <input
              ref={inputImagenRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={cargarImagenPunto}
            />
            <button
              type="button"
              onClick={copiarEnlace}
              className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
            >
              {enlaceCopiado ? "✓ ¡Copiado!" : "🔗 Copiar enlace limpio"}
            </button>
          </div>

          <div ref={reporteRef}>
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-600">
              Periodo: {reporte.desde} a {reporte.hasta}
            </p>
            <p className="mt-1 text-lg font-semibold">
              Total de ventas: ${reporte.totalVentasUsd.toFixed(2)} ({reporte.cantidadVentas}{" "}
              {reporte.cantidadVentas === 1 ? "venta" : "ventas"})
            </p>
            {imagenPunto && imagenExpandida && (
              <div className="mt-3 border-t border-zinc-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Imagen punto de venta</p>
                  <button
                    type="button"
                    onClick={compartirWhatsAppConImagen}
                    className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Compartir
                  </button>
                </div>
                <img src={imagenPunto} alt="Punto de venta" className="max-h-64 w-full rounded-md object-contain" />
              </div>
            )}
          </div>

          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por forma de pago
            </h3>
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Forma de pago</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total $</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total Bs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porFormaPago.map((fp) => (
                  <tr key={fp.metodo}>
                    <td className="px-4 py-2 font-medium">{METODO_PAGO_LABELS[fp.metodo]}</td>
                    <td className="px-4 py-2 text-right">${fp.totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">Bs {fp.totalBs.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-zinc-200 bg-zinc-50">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    ${reporte.porFormaPago.reduce((acc, fp) => acc + fp.totalUsd, 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    Bs {reporte.porFormaPago.reduce((acc, fp) => acc + fp.totalBs, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>

          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por cliente
            </h3>
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cédula</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Ventas</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porCliente.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      No hay ventas en el periodo seleccionado
                    </td>
                  </tr>
                )}
                {reporte.porCliente.map((c) => (
                  <tr key={`${c.cliente}-${c.clienteCi ?? ""}`}>
                    <td className="px-4 py-2 font-medium">{c.cliente}</td>
                    <td className="px-4 py-2 text-zinc-600">{c.clienteCi ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{c.cantidadVentas}</td>
                    <td className="px-4 py-2 text-right">${c.totalUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {reporte.porCliente.length > 0 && (
                <tfoot className="border-t border-zinc-200 bg-zinc-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {reporte.porCliente.reduce((acc, c) => acc + c.cantidadVentas, 0)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      ${reporte.porCliente.reduce((acc, c) => acc + c.totalUsd, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>

          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por producto
            </h3>
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Producto</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Cantidad</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total $</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Margen $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porProducto.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      No hay ventas en el periodo seleccionado
                    </td>
                  </tr>
                )}
                {reporte.porProducto.map((p) => (
                  <tr key={p.productoId}>
                    <td className="px-4 py-2 font-medium">{p.nombre}</td>
                    <td className="px-4 py-2 text-right">{p.cantidad}</td>
                    <td className="px-4 py-2 text-right">${p.totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">${p.margenUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {reporte.porProducto.length > 0 && (
                <tfoot className="border-t border-zinc-200 bg-zinc-50">
                  <tr>
                    <td className="px-4 py-2 font-semibold">Total</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {reporte.porProducto.reduce((acc, p) => acc + p.cantidad, 0)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      ${reporte.porProducto.reduce((acc, p) => acc + p.totalUsd, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      ${reporte.porProducto.reduce((acc, p) => acc + p.margenUsd, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}

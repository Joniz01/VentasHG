"use client";

import { FormEvent, useRef, useState } from "react";
import Paginador from "@/components/Paginador";
import { useSearchParams } from "next/navigation";
import type { ReporteVentas, ReporteDetalleVenta } from "@/lib/types";
import { METODO_PAGO_LABELS, METODOS_PAGO } from "@/lib/types";
import DeliveryPagosPanel from "@/components/DeliveryPagosPanel";

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
  const [tab, setTab] = useState<"ventas" | "conciliacion" | "deliveries">(
    tabInicial === "deliveries" ? "deliveries" : tabInicial === "conciliacion" ? "conciliacion" : "ventas"
  );
  const [concilMetodo, setConcilMetodo] = useState<string>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mesEspecifico, setMesEspecifico] = useState("");
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePendientes, setIncludePendientes] = useState(false);
  const [imagenPunto, setImagenPunto] = useState<string | null>(null);
  const [imagenExpandida, setImagenExpandida] = useState(false);
  const [imagenFullscreen, setImagenFullscreen] = useState(false);
  const [enlaceCopiado, setEnlaceCopiado] = useState(false);
  const [resumenHoy, setResumenHoy] = useState<{ ventaHoy: number; ingresos: number } | null>(null);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [paginaCliente, setPaginaCliente] = useState(1);
  const [porPaginaCliente, setPorPaginaCliente] = useState(10);
  const [paginaProducto, setPaginaProducto] = useState(1);
  const [porPaginaProducto, setPorPaginaProducto] = useState(10);
  const reporteRef = useRef<HTMLDivElement>(null);
  const inputImagenRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);

  async function cargarImagenExistente(desdeParam: string, hastaParam: string) {
    try {
      const res = await fetch(`/api/reportes/imagen?desde=${desdeParam}&hasta=${hastaParam}`);
      const json = await res.json();
      setImagenPunto(json.data ?? null);
      setImagenExpandida(false);
    } catch {
      setImagenPunto(null);
    }
  }

  async function eliminarImagen() {
    if (!reporte) return;
    if (!confirm("¿Eliminar la imagen del punto de venta?")) return;
    await fetch(`/api/reportes/imagen?desde=${reporte.desde}&hasta=${reporte.hasta}`, { method: "DELETE" });
    setImagenPunto(null);
    setImagenExpandida(false);
  }

  function compartirWhatsApp() {
    if (!reporte) return;
    const empresa = process.env.NEXT_PUBLIC_EMPRESA_NOMBRE ?? "";
    const fecha = reporte.desde === reporte.hasta ? reporte.desde : `${reporte.desde} al ${reporte.hasta}`;
    const url = buildVistaUrl();
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
        .map((fp) => `• ${METODO_PAGO_LABELS[fp.metodo]}: $${fp.totalUsd.toFixed(2)} / Bs ${fp.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      ``,
      url,
    ].filter((l) => l !== null);
    const texto = lineas.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  function comprimirImagen(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1200;
        const scale = img.width > maxW ? maxW / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = dataUrl;
    });
  }

  function cargarImagenPunto(e: React.ChangeEvent<HTMLInputElement>) {
    if (!reporte) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      const data = await comprimirImagen(raw);
      setImagenPunto(data);
      setImagenExpandida(false);
      try {
        await fetch("/api/reportes/imagen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, desde: reporte.desde, hasta: reporte.hasta }),
        });
      } catch {}
    };
    reader.readAsDataURL(file);
  }

  function compartirWhatsAppConImagen() {
    const texto = `📊 *Reporte de Ventas*\n💰 Total: $${reporte?.totalVentasUsd.toFixed(2)} (${reporte?.cantidadVentas} ventas)\n\n_Adjunta la imagen del punto de venta_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  function buildVistaUrl() {
    if (!reporte) return "";
    return `${window.location.origin}/reportes/vista?desde=${reporte.desde}&hasta=${reporte.hasta}`;
  }

  function copiarEnlace() {
    const url = buildVistaUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setEnlaceCopiado(true);
      setTimeout(() => setEnlaceCopiado(false), 2000);
    });
  }

  async function generar(desdeParam: string, hastaParam: string) {
    setError(null);
    setLoading(true);
    setDesde(desdeParam);
    setResumenHoy(null);
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
      setPaginaCliente(1);
      setPaginaProducto(1);
      await cargarImagenExistente(desdeParam, hastaParam);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar el reporte");
      setReporte(null);
      setImagenPunto(null);
    } finally {
      setLoading(false);
    }
  }

  function handleHoy() {
    setMesEspecifico("");
    const hoy = toIsoDate(new Date());
    generar(hoy, hoy);
    fetch("/api/resumen")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ventaHoy?.total_usd != null && d?.ingresos?.total_usd != null) {
          setResumenHoy({ ventaHoy: Number(d.ventaHoy.total_usd), ingresos: Number(d.ingresos.total_usd) });
        }
      })
      .catch(() => {});
  }

  function handleAyer() {
    setMesEspecifico("");
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    const ayerStr = toIsoDate(ayer);
    generar(ayerStr, ayerStr);
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

  const NAV_CARDS = [
    { key: "ventas",       icon: "📑", label: "Ventas",           sub: "Reportes y resúmenes" },
    { key: "conciliacion", icon: "🔍", label: "Conciliación",     sub: "Cuadre por método de pago" },
    { key: "deliveries",   icon: "📬", label: "Pagos a Delivery", sub: "Liquidaciones de delivery" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        {NAV_CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setTab(c.key)}
            style={{
              background: "var(--erp-surface)",
              border: tab === c.key ? "2px solid var(--erp-primary)" : "1px solid var(--erp-border)",
              borderTop: tab === c.key ? `3px solid var(--erp-primary)` : `3px solid var(--erp-border)`,
              borderRadius: 8,
              padding: "10px 12px",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              boxShadow: tab === c.key ? "0 0 0 1px var(--erp-primary)" : "none",
            }}
          >
            <span style={{ fontSize: 20 }}>{c.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: tab === c.key ? "var(--erp-primary)" : "var(--erp-text)" }}>{c.label}</span>
            <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{c.sub}</span>
          </button>
        ))}
      </div>

      {tab === "deliveries" && <DeliveryPagosPanel />}

      {tab === "conciliacion" && (
        <ConciliacionPanel reporte={reporte} metodo={concilMetodo} setMetodo={setConcilMetodo} loading={loading} />
      )}

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
            onClick={handleAyer}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Ayer
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

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-600 uppercase tracking-wide">Filtrar por forma de pago</span>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO.map((m) => {
              const activo = metodosPago.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    setMetodosPago((prev) =>
                      activo ? prev.filter((x) => x !== m) : [...prev, m]
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    activo
                      ? "border-zinc-800 bg-zinc-800 text-white"
                      : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {METODO_PAGO_LABELS[m]}
                </button>
              );
            })}
            {metodosPago.length > 0 && (
              <button
                type="button"
                onClick={() => setMetodosPago([])}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-700"
              >
                Limpiar filtro
              </button>
            )}
          </div>
        </div>
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => inputCamaraRef.current?.click()}
                title="Capturar con cámara"
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
              >
                📷 Cámara
              </button>
              <button
                type="button"
                onClick={() => inputImagenRef.current?.click()}
                title="Seleccionar desde galería"
                className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
              >
                🖼️ Galería
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
            {/* Cámara — fuerza apertura de cámara trasera en móvil */}
            <input
              ref={inputCamaraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={cargarImagenPunto}
            />
            {/* Galería — abre selector de archivos/imágenes */}
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
            {resumenHoy ? (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-500">Venta Hoy</span>
                  <span className="text-sm font-semibold text-zinc-800">${resumenHoy.ventaHoy.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-500">Ingresos</span>
                  <span className="text-sm font-semibold text-zinc-800">${resumenHoy.ingresos.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2">
                  <span className="text-sm font-semibold text-green-700">Total Ingreso Hoy</span>
                  <span className="text-sm font-bold text-green-700">${(resumenHoy.ventaHoy + resumenHoy.ingresos).toFixed(2)}</span>
                </div>
                <p className="text-xs text-zinc-400">({reporte.cantidadVentas} {reporte.cantidadVentas === 1 ? "venta" : "ventas"} registradas)</p>
              </div>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold">
                  Total de ventas: ${reporte.totalVentasUsd.toFixed(2)} ({reporte.cantidadVentas}{" "}
                  {reporte.cantidadVentas === 1 ? "venta" : "ventas"})
                </p>
                <p className="text-sm text-zinc-500">
                  Bs {reporte.totalVentasBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </>
            )}
            {imagenPunto && imagenExpandida && (
              <div className="mt-3 border-t border-zinc-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Imagen punto de venta</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={compartirWhatsAppConImagen}
                      className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Compartir
                    </button>
                    <button
                      type="button"
                      onClick={eliminarImagen}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      🗑 Eliminar
                    </button>
                  </div>
                </div>
                <img
                  src={imagenPunto}
                  alt="Punto de venta"
                  onClick={() => setImagenFullscreen(true)}
                  className="max-h-64 w-full rounded-md object-contain cursor-zoom-in"
                  title="Click para ampliar"
                />
              </div>
            )}

            {imagenFullscreen && imagenPunto && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                onClick={() => setImagenFullscreen(false)}
              >
                <img
                  src={imagenPunto}
                  alt="Punto de venta ampliado"
                  className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
                />
                <button
                  type="button"
                  className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-zinc-300"
                  onClick={() => setImagenFullscreen(false)}
                >
                  ✕
                </button>
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
                {reporte.porFormaPago
                  .filter((fp) => metodosPago.length === 0 || metodosPago.includes(fp.metodo))
                  .map((fp) => (
                    <tr key={fp.metodo}>
                      <td className="px-4 py-2 font-medium">{METODO_PAGO_LABELS[fp.metodo]}</td>
                      <td className="px-4 py-2 text-right">${fp.totalUsd.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">Bs {fp.totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot className="border-t border-zinc-200 bg-zinc-50">
                {(() => {
                  const filtered = reporte.porFormaPago.filter(
                    (fp) => metodosPago.length === 0 || metodosPago.includes(fp.metodo)
                  );
                  return (
                    <tr>
                      <td className="px-4 py-2 font-semibold">Total{metodosPago.length > 0 ? " (filtrado)" : ""}</td>
                      <td className="px-4 py-2 text-right font-semibold">
                        ${filtered.reduce((acc, fp) => acc + fp.totalUsd, 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        Bs {filtered.reduce((acc, fp) => acc + fp.totalBs, 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })()}
              </tfoot>
            </table>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por cliente
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--erp-text-3)" }}>(incluye cargos por manejo y envío)</span>
            </h3>
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
                  <th className="px-4 py-2 text-left font-medium text-zinc-600">Cédula</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600"># Ventas</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Total Venta $</th>
                  <th className="px-4 py-2 text-right font-medium text-red-600">Pendiente $</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Cobrado Bs</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-600">Cobrado $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porCliente.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                      No hay ventas en el periodo seleccionado
                    </td>
                  </tr>
                )}
                {reporte.porCliente
                  .slice((paginaCliente - 1) * porPaginaCliente, paginaCliente * porPaginaCliente)
                  .map((c) => (
                  <tr key={`${c.cliente}-${c.clienteCi ?? ""}`} className="hover:bg-zinc-50">
                    <td className="px-4 py-2 font-medium">{c.cliente}</td>
                    <td className="px-4 py-2 text-zinc-600">{c.clienteCi ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{c.cantidadVentas}</td>
                    <td className="px-4 py-2 text-right tabular-nums">${c.totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium" style={{ color: c.pendienteUsd >= 0.01 ? "#DC2626" : "inherit" }}>
                      {c.pendienteUsd >= 0.01 ? `$${c.pendienteUsd.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                      Bs {c.cobradoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold">${c.cobradoUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {reporte.porCliente.length > 0 && (
                <tfoot className="border-t border-zinc-200 bg-zinc-50 font-semibold">
                  <tr>
                    <td colSpan={2} className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">
                      {reporte.porCliente.reduce((acc, c) => acc + c.cantidadVentas, 0)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      ${reporte.porCliente.reduce((acc, c) => acc + c.totalUsd, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums" style={{ color: "#DC2626" }}>
                      {(() => { const t = reporte.porCliente.reduce((acc, c) => acc + c.pendienteUsd, 0); return t >= 0.01 ? `$${t.toFixed(2)}` : "-"; })()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-600">
                      Bs {reporte.porCliente.reduce((acc, c) => acc + c.cobradoBs, 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      ${reporte.porCliente.reduce((acc, c) => acc + c.cobradoUsd, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
            <Paginador
              total={reporte.porCliente.length}
              pagina={paginaCliente}
              porPagina={porPaginaCliente}
              opcionesPorPagina={[10, 15, 20, 25, 50]}
              onPagina={setPaginaCliente}
              onPorPagina={setPorPaginaCliente}
            />
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <h3 className="border-b border-zinc-200 px-4 py-3 text-base font-semibold">
              Ventas por producto
            </h3>
            <div className="overflow-x-auto">
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
                {reporte.porProducto
                  .slice((paginaProducto - 1) * porPaginaProducto, paginaProducto * porPaginaProducto)
                  .map((p) => (
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
            </div>
            <Paginador
              total={reporte.porProducto.length}
              pagina={paginaProducto}
              porPagina={porPaginaProducto}
              opcionesPorPagina={[10, 15, 20, 25, 50]}
              onPagina={setPaginaProducto}
              onPorPagina={setPorPaginaProducto}
            />
          </section>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}

// ── Conciliación por forma de pago ────────────────────────────────────────────
function ConciliacionPanel({
  reporte,
  metodo,
  setMetodo,
  loading,
}: {
  reporte: ReporteVentas | null;
  metodo: string;
  setMetodo: (m: string) => void;
  loading: boolean;
}) {
  if (loading) return <div className="text-sm text-zinc-500">Generando reporte...</div>;

  if (!reporte) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500">
        Genera un reporte en la pestaña <strong>Ventas</strong> para ver la conciliación por forma de pago.
      </div>
    );
  }

  const metodosConVentas = METODOS_PAGO.filter(
    (m) => (reporte.ventasPorFormaPago?.[m]?.length ?? 0) > 0
  );

  const ventas: ReporteDetalleVenta[] = metodo
    ? (reporte.ventasPorFormaPago?.[metodo] ?? [])
    : metodosConVentas.flatMap((m) => reporte.ventasPorFormaPago?.[m] ?? []);

  const totalUsd = ventas.reduce((s, v) => s + v.montoUsd, 0);
  const totalBs = ventas.reduce((s, v) => s + v.montoBs, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de forma de pago */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMetodo("")}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !metodo ? "border-zinc-800 bg-zinc-800 text-white" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
          }`}
        >
          Todos
        </button>
        {metodosConVentas.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetodo(metodo === m ? "" : m)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              metodo === m ? "border-zinc-800 bg-zinc-800 text-white" : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500"
            }`}
          >
            {METODO_PAGO_LABELS[m as keyof typeof METODO_PAGO_LABELS]} ({reporte.ventasPorFormaPago?.[m]?.length ?? 0})
          </button>
        ))}
      </div>

      {/* Tabla de ventas */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="text-base font-semibold">
            {metodo ? METODO_PAGO_LABELS[metodo as keyof typeof METODO_PAGO_LABELS] : "Todas las formas de pago"}
            <span className="ml-2 text-sm font-normal text-zinc-500">{ventas.length} {ventas.length === 1 ? "venta" : "ventas"}</span>
          </h3>
        </div>
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pedido</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto $</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Monto Bs</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ventas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">Sin ventas en este período</td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr key={`${metodo}-${v.ventaId}`} className="hover:bg-zinc-50">
                  <td className="px-4 py-2 font-medium text-zinc-700">#{v.ventaId}</td>
                  <td className="px-4 py-2 text-zinc-700">{v.cliente}</td>
                  <td className="px-4 py-2 text-right font-variant-numeric tabular-nums">${v.montoUsd.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-zinc-500 font-variant-numeric tabular-nums">Bs {v.montoBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={`/ventas/${v.ventaId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                    >
                      Ver →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="border-t border-zinc-200 bg-zinc-50">
            <tr>
              <td colSpan={2} className="px-4 py-2 font-semibold">Total</td>
              <td className="px-4 py-2 text-right font-semibold">${totalUsd.toFixed(2)}</td>
              <td className="px-4 py-2 text-right font-semibold">Bs {totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getReporte } from "@/lib/getReporte";
import { METODO_PAGO_LABELS } from "@/lib/types";
import ImagenPuntoToggle from "./ImagenPuntoToggle";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}

export default async function ReporteVistaPage({ searchParams }: Props) {
  const { desde, hasta } = await searchParams;

  if (!desde || !hasta) notFound();

  const reporte = await getReporte(desde, hasta);

  const empresa = process.env.EMPRESA_NOMBRE ?? "VentasHG";
  const empresaColor = process.env.EMPRESA_COLOR ?? "";
  const periodo = desde === hasta ? desde : `${desde} al ${hasta}`;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header
        className="border-b border-zinc-200 bg-white px-4 py-4"
        style={empresaColor ? { backgroundColor: empresaColor } : {}}
      >
        <h1 className="text-lg font-semibold">{empresa}</h1>
        <p className="text-sm text-zinc-500">Reporte de Ventas</p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-sm text-zinc-500">Periodo: {periodo}</p>
          <p className="mt-1 text-xl font-bold">
            ${reporte.totalVentasUsd.toFixed(2)}
          </p>
          <p className="text-sm text-zinc-600">
            {reporte.cantidadVentas} {reporte.cantidadVentas === 1 ? "venta" : "ventas"}
          </p>
          <ImagenPuntoToggle />
        </div>

        <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">
            Por forma de pago
          </h2>
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-zinc-500">Método</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Total $</th>
                <th className="px-4 py-2 text-right font-medium text-zinc-500">Total Bs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reporte.porFormaPago
                .filter((fp) => fp.totalUsd > 0 || fp.totalBs > 0)
                .map((fp) => (
                  <tr key={fp.metodo}>
                    <td className="px-4 py-2">{METODO_PAGO_LABELS[fp.metodo]}</td>
                    <td className="px-4 py-2 text-right">${fp.totalUsd.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">Bs {fp.totalBs.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="border-t border-zinc-200 bg-zinc-50">
              <tr>
                <td className="px-4 py-2 font-semibold">Total</td>
                <td className="px-4 py-2 text-right font-semibold">
                  ${reporte.porFormaPago.reduce((a, fp) => a + fp.totalUsd, 0).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  Bs {reporte.porFormaPago.reduce((a, fp) => a + fp.totalBs, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {reporte.porProducto.length > 0 && (
          <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold">
              Por producto
            </h2>
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Producto</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Cant.</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Total $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {reporte.porProducto.map((p) => (
                  <tr key={p.productoId}>
                    <td className="px-4 py-2">{p.nombre}</td>
                    <td className="px-4 py-2 text-right">{p.cantidad}</td>
                    <td className="px-4 py-2 text-right">${p.totalUsd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}

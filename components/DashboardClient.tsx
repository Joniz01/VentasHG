"use client";

import { useEffect, useState } from "react";

type Periodo = { cantidad: number; total_usd: number };
type Stock = { total_productos: number; sin_stock: number };

type EmpresaData = {
  empresa: string;
  hoy: Periodo;
  semana: Periodo;
  mes: Periodo;
  cxcPendiente: Periodo;
  stock: Stock;
  error?: string;
};

function fmt(n: number) {
  return `$${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  label,
  cantidad,
  total,
  alerta,
}: {
  label: string;
  cantidad: number;
  total: number;
  alerta?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${alerta ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${alerta ? "text-red-500" : "text-zinc-500"}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${alerta ? "text-red-700" : "text-zinc-900"}`}>
        {fmt(total)}
      </p>
      <p className={`text-sm ${alerta ? "text-red-500" : "text-zinc-500"}`}>
        {cantidad} {cantidad === 1 ? "venta" : "ventas"}
      </p>
    </div>
  );
}

function EmpresaPanel({ data }: { data: EmpresaData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-zinc-800">{data.empresa}</h3>
        {data.error && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">
            {data.error}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hoy" cantidad={data.hoy.cantidad} total={data.hoy.total_usd} />
        <StatCard label="Esta semana" cantidad={data.semana.cantidad} total={data.semana.total_usd} />
        <StatCard label="Este mes" cantidad={data.mes.cantidad} total={data.mes.total_usd} />
        <StatCard
          label="CxC Pendiente"
          cantidad={data.cxcPendiente.cantidad}
          total={data.cxcPendiente.total_usd}
          alerta={data.cxcPendiente.cantidad > 0}
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-zinc-700">Inventario (productos NORMAL activos)</p>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-zinc-500">Total productos: </span>
            <span className="font-semibold">{data.stock.total_productos}</span>
          </div>
          <div>
            <span className="text-zinc-500">Sin stock: </span>
            <span className={`font-semibold ${data.stock.sin_stock > 0 ? "text-red-600" : "text-green-600"}`}>
              {data.stock.sin_stock}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComparativoTable({ empresas }: { empresas: EmpresaData[] }) {
  const periodos: { key: keyof EmpresaData; label: string }[] = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Esta semana" },
    { key: "mes", label: "Este mes" },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-zinc-600">Periodo</th>
            {empresas.map((e) => (
              <th key={e.empresa} className="px-4 py-2 text-right font-medium text-zinc-600">
                {e.empresa}
              </th>
            ))}
            {empresas.length > 1 && (
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Consolidado</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {periodos.map(({ key, label }) => {
            const total = empresas.reduce((acc, e) => {
              const p = e[key] as Periodo;
              return acc + (p?.total_usd ?? 0);
            }, 0);
            return (
              <tr key={key}>
                <td className="px-4 py-2 font-medium text-zinc-700">{label}</td>
                {empresas.map((e) => {
                  const p = e[key] as Periodo;
                  return (
                    <td key={e.empresa} className="px-4 py-2 text-right">
                      {fmt(p?.total_usd ?? 0)}
                      <span className="ml-1 text-xs text-zinc-400">({p?.cantidad ?? 0})</span>
                    </td>
                  );
                })}
                {empresas.length > 1 && (
                  <td className="px-4 py-2 text-right font-semibold">{fmt(total)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardClient() {
  const [empresas, setEmpresas] = useState<EmpresaData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al cargar");
      setEmpresas(data.empresas as EmpresaData[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  if (loading) {
    return <div className="text-sm text-zinc-500">Cargando indicadores...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <button onClick={cargar} className="ml-3 underline">Reintentar</button>
      </div>
    );
  }

  if (!empresas?.length) {
    return (
      <div className="text-sm text-zinc-500">
        No hay empresas configuradas. Revisa las variables de entorno.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <button
          onClick={cargar}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
        >
          Actualizar
        </button>
      </div>

      {empresas.length > 1 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Comparativo
          </h3>
          <ComparativoTable empresas={empresas} />
        </section>
      )}

      {empresas.map((e) => (
        <section key={e.empresa} className="flex flex-col gap-3">
          <EmpresaPanel data={e} />
        </section>
      ))}
    </div>
  );
}

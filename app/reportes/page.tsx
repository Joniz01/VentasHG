import ReportesClient from "@/components/ReportesClient";

export const dynamic = "force-dynamic";

export default function ReportesPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Reportes</h2>
      <p className="mb-4 text-sm text-zinc-600">
        Genera reportes de ventas por rango de fechas, por demanda.
      </p>
      <ReportesClient />
    </div>
  );
}

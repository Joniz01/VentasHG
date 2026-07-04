"use client";

type Props = {
  total: number;
  pagina: number;
  porPagina: number;
  opcionesPorPagina: number[];
  onPagina: (p: number) => void;
  onPorPagina: (n: number) => void;
};

export default function Paginador({ total, pagina, porPagina, opcionesPorPagina, onPagina, onPorPagina }: Props) {
  const totalPaginas = Math.ceil(total / porPagina);
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 px-4 py-2 text-sm text-zinc-600">
      <span>
        {desde}–{hasta} de {total}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={porPagina}
          onChange={(e) => { onPorPagina(Number(e.target.value)); onPagina(1); }}
          className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs"
        >
          {opcionesPorPagina.map((n) => (
            <option key={n} value={n}>{n} por página</option>
          ))}
        </select>
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => onPagina(pagina - 1)}
          className="rounded px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-30"
        >
          «
        </button>
        <span className="text-xs">{pagina}/{totalPaginas}</span>
        <button
          type="button"
          disabled={pagina >= totalPaginas}
          onClick={() => onPagina(pagina + 1)}
          className="rounded px-2 py-0.5 hover:bg-zinc-100 disabled:opacity-30"
        >
          »
        </button>
      </div>
    </div>
  );
}

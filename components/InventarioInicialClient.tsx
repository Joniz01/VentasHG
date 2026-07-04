"use client";

import { useState } from "react";

type Producto = { id: number; nombre: string; stockActual: number };

export default function InventarioInicialClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargado, setCargado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [reseteando, setReseteando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [checkConfirmado, setCheckConfirmado] = useState(false);

  async function cargarProductos() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();
      const normales = (data as { id: number; nombre: string; stockActual: number; tipoProducto: string }[])
        .filter((p) => p.tipoProducto === "NORMAL")
        .map((p) => ({ id: p.id, nombre: p.nombre, stockActual: p.stockActual }));
      setProductos(normales);
      setCargado(true);
    } catch {
      setError("No se pudieron cargar los productos");
    } finally {
      setCargando(false);
    }
  }

  async function handleReset() {
    setReseteando(true);
    setError(null);
    setResultado(null);
    setConfirmando(false);
    setCheckConfirmado(false);
    try {
      const res = await fetch("/api/inventario/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al inicializar");
      setResultado(
        data.actualizados === 0
          ? "Todos los productos ya tenían stock en cero."
          : `${data.actualizados} producto(s) llevado(s) a cero correctamente.`
      );
      setProductos((prev) => prev.map((p) => ({ ...p, stockActual: 0 })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al inicializar el inventario");
    } finally {
      setReseteando(false);
    }
  }

  const conStock = productos.filter((p) => p.stockActual > 0);

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
        <p className="font-semibold mb-1">Inicialización de inventario</p>
        <p>
          Esta acción lleva a <strong>cero</strong> el stock de todos los productos normales activos.
          Úsala solo al comenzar operaciones o para reiniciar el conteo. El movimiento quedará
          registrado en el historial de inventario.
        </p>
      </div>

      {!cargado ? (
        <button
          type="button"
          onClick={cargarProductos}
          disabled={cargando}
          className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50"
        >
          {cargando ? "Cargando..." : "Ver estado actual del inventario"}
        </button>
      ) : (
        <>
          <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
            <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Productos normales activos ({productos.length})
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
              {productos.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">No hay productos normales activos</p>
              )}
              {productos.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-zinc-800">{p.nombre}</span>
                  <span className={`font-medium tabular-nums ${p.stockActual > 0 ? "text-zinc-700" : "text-zinc-400"}`}>
                    {p.stockActual}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {conStock.length > 0 && (
            <p className="text-sm text-zinc-600">
              <strong>{conStock.length}</strong> producto(s) con stock mayor a cero serán ajustados.
            </p>
          )}

          {resultado && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
              {resultado}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { setConfirmando(true); setCheckConfirmado(false); }}
              disabled={reseteando || productos.length === 0}
              className="self-start rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Llevar todo el inventario a cero
            </button>

            {confirmando && (
              <div className="flex flex-col gap-3 rounded-md border border-red-300 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  ¿Está seguro que desea llevar a cero su inventario?
                </p>
                <p className="text-xs text-red-700">
                  Esta acción ajustará el stock de todos los productos a cero y quedará registrada en el historial. No se puede deshacer automáticamente.
                </p>
                <label className="flex items-center gap-2 text-sm text-red-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkConfirmado}
                    onChange={(e) => setCheckConfirmado(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                  Sí, estoy seguro y deseo llevar el inventario a cero
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!checkConfirmado || reseteando}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {reseteando ? "Procesando..." : "Llevar todo el inventario a cero"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setConfirmando(false); setCheckConfirmado(false); }}
                    className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

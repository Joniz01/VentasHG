"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  METODOS_PAGO,
  METODO_PAGO_LABELS,
  MODOS_ENTREGA,
  type MetodoPago,
  type ModoEntrega,
  type Producto,
  type Venta,
} from "@/lib/types";

type ItemRow = { productoId: string; cantidad: string };
type PagoRow = { metodo: MetodoPago; monto: string };

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_ITEM: ItemRow = { productoId: "", cantidad: "1" };
const EMPTY_PAGO: PagoRow = { metodo: "EFECTIVO_BS", monto: "" };

export default function VentasClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fecha, setFecha] = useState(today());
  const [tasaDelDia, setTasaDelDia] = useState("");
  const [cliente, setCliente] = useState("");
  const [modalidadCompra, setModalidadCompra] = useState("");
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>("LOCAL");
  const [costoDelivery, setCostoDelivery] = useState("0");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [pagos, setPagos] = useState<PagoRow[]>([{ ...EMPTY_PAGO }]);

  async function loadData() {
    try {
      const [productosRes, ventasRes] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/ventas"),
      ]);
      setProductos(await productosRes.json());
      setVentas(await ventasRes.json());
    } catch {
      setError("No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const productosById = useMemo(() => {
    const map = new Map<number, Producto>();
    productos.forEach((p) => map.set(p.id, p));
    return map;
  }, [productos]);

  const totales = useMemo(() => {
    let costoTotal = 0;
    let ventaTotal = 0;

    for (const item of items) {
      const producto = productosById.get(Number(item.productoId));
      const cantidad = Number(item.cantidad) || 0;
      if (!producto) continue;
      costoTotal += producto.costo * cantidad;
      ventaTotal += producto.precioVenta * cantidad;
    }

    const totalPagos = pagos.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    return { costoTotal, ventaTotal, totalPagos };
  }, [items, pagos, productosById]);

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePago(index: number, patch: Partial<PagoRow>) {
    setPagos((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPago() {
    setPagos((prev) => [...prev, { ...EMPTY_PAGO }]);
  }

  function removePago(index: number) {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setFecha(today());
    setTasaDelDia("");
    setCliente("");
    setModalidadCompra("");
    setModoEntrega("LOCAL");
    setCostoDelivery("0");
    setObservaciones("");
    setItems([{ ...EMPTY_ITEM }]);
    setPagos([{ ...EMPTY_PAGO }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!cliente.trim()) {
      setError("El cliente es obligatorio");
      return;
    }

    const validItems = items.filter((i) => i.productoId && Number(i.cantidad) > 0);
    if (validItems.length === 0) {
      setError("Agrega al menos un producto con cantidad válida");
      return;
    }

    const validPagos = pagos.filter((p) => Number(p.monto) > 0);

    setSaving(true);
    try {
      const payload = {
        fecha,
        tasaDelDia: Number(tasaDelDia) || 0,
        cliente: cliente.trim(),
        modalidadCompra: modalidadCompra.trim(),
        modoEntrega,
        costoDelivery: Number(costoDelivery) || 0,
        observaciones: observaciones.trim(),
        items: validItems.map((i) => ({
          productoId: Number(i.productoId),
          cantidad: Number(i.cantidad),
        })),
        pagos: validPagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })),
      };

      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al registrar la venta");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la venta");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta venta?")) return;
    try {
      const res = await fetch(`/api/ventas/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al eliminar la venta");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la venta");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Fecha</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Tasa del día</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={tasaDelDia}
              onChange={(e) => setTasaDelDia(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Cliente</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Modo de entrega</label>
            <select
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={modoEntrega}
              onChange={(e) => setModoEntrega(e.target.value as ModoEntrega)}
            >
              {MODOS_ENTREGA.map((m) => (
                <option key={m} value={m}>
                  {m === "LOCAL" ? "Local" : "Delivery"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Costo delivery</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={costoDelivery}
              onChange={(e) => setCostoDelivery(e.target.value)}
              disabled={modoEntrega !== "DELIVERY"}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Modalidad de compra</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={modalidadCompra}
              onChange={(e) => setModalidadCompra(e.target.value)}
              placeholder="Ej: Mayor, Detal..."
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Observaciones</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Productos</h3>
            <button
              type="button"
              onClick={addItem}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
            >
              + Agregar producto
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((item, index) => {
              const producto = productosById.get(Number(item.productoId));
              const cantidad = Number(item.cantidad) || 0;
              return (
                <div key={index} className="grid grid-cols-12 items-center gap-2">
                  <select
                    className="col-span-6 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-7"
                    value={item.productoId}
                    onChange={(e) => updateItem(index, { productoId: e.target.value })}
                  >
                    <option value="">Selecciona un producto</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                    value={item.cantidad}
                    onChange={(e) => updateItem(index, { cantidad: e.target.value })}
                    placeholder="Cantidad"
                  />
                  <div className="col-span-2 text-right text-sm text-zinc-600 sm:col-span-2">
                    {producto ? (producto.precioVenta * cantidad).toFixed(2) : "-"}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="col-span-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    X
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-700">Forma de pago</h3>
            <button
              type="button"
              onClick={addPago}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
            >
              + Agregar pago
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {pagos.map((pago, index) => (
              <div key={index} className="grid grid-cols-12 items-center gap-2">
                <select
                  className="col-span-7 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-8"
                  value={pago.metodo}
                  onChange={(e) => updatePago(index, { metodo: e.target.value as MetodoPago })}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {METODO_PAGO_LABELS[m]}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="col-span-4 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3"
                  value={pago.monto}
                  onChange={(e) => updatePago(index, { monto: e.target.value })}
                  placeholder="Monto"
                />
                <button
                  type="button"
                  onClick={() => removePago(index)}
                  className="col-span-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-md bg-zinc-50 p-3 text-sm sm:grid-cols-3">
          <div>
            <span className="font-medium text-zinc-600">Costo total: </span>
            {totales.costoTotal.toFixed(2)}
          </div>
          <div>
            <span className="font-medium text-zinc-600">Total venta: </span>
            {totales.ventaTotal.toFixed(2)}
          </div>
          <div>
            <span className="font-medium text-zinc-600">Total pagado: </span>
            {totales.totalPagos.toFixed(2)}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Registrar venta
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Fecha</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Productos</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pagos</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Costo total</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Total venta</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Entrega</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && ventas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  No hay ventas registradas
                </td>
              </tr>
            )}
            {ventas.map((venta) => {
              const costoTotal = venta.items.reduce(
                (acc, i) => acc + i.costoUnit * i.cantidad,
                0
              );
              const ventaTotal = venta.items.reduce(
                (acc, i) => acc + i.precioUnit * i.cantidad,
                0
              );
              return (
                <tr key={venta.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(venta.fecha).toLocaleDateString("es-VE")}
                  </td>
                  <td className="px-4 py-2 font-medium">{venta.cliente}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {venta.items
                      .map((i) => `${i.nombreProducto} x${i.cantidad}`)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {venta.pagos
                      .map((p) => `${METODO_PAGO_LABELS[p.metodo]}: ${p.monto.toFixed(2)}`)
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-2 text-right">{costoTotal.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{ventaTotal.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {venta.modoEntrega === "DELIVERY" ? "Delivery" : "Local"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(venta.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

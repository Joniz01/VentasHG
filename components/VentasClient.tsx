"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  METODOS_PAGO,
  METODOS_PAGO_USD,
  METODO_PAGO_LABELS,
  MODOS_ENTREGA,
  type MetodoPago,
  type ModoEntrega,
  type Cliente,
  type Producto,
  type Venta,
} from "@/lib/types";

type ItemRow = { productoId: string; cantidad: string; extraId: string };
type PagoRow = { metodo: MetodoPago | ""; monto: string; montoAuto: boolean };

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_ITEM: ItemRow = { productoId: "", cantidad: "1", extraId: "" };
const EMPTY_PAGO: PagoRow = { metodo: "", monto: "", montoAuto: true };

function bsToUsd(montoBs: number, tasa: number) {
  return tasa > 0 ? montoBs / tasa : 0;
}

function usdToBs(montoUsd: number, tasa: number) {
  return montoUsd * tasa;
}

export default function VentasClient() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [fecha, setFecha] = useState(today());
  const [tasaDelDia, setTasaDelDia] = useState("");
  const [cliente, setCliente] = useState("");
  const [clienteCi, setClienteCi] = useState("");
  const [direccion, setDireccion] = useState("");
  const [modalidadCompra, setModalidadCompra] = useState("");
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>("LOCAL");
  const [costoDelivery, setCostoDelivery] = useState("0");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [pagos, setPagos] = useState<PagoRow[]>([{ ...EMPTY_PAGO }]);
  const [tasaBcvFecha, setTasaBcvFecha] = useState<string | null>(null);
  const [tasaBcvError, setTasaBcvError] = useState<string | null>(null);
  const [consultandoTasa, setConsultandoTasa] = useState(false);

  const [clientesResultados, setClientesResultados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);

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
    handleConsultarTasaBcv();
  }, []);

  async function buscarClientes(q: string) {
    const query = q.trim();
    if (query.length < 4) {
      setClientesResultados([]);
      setMostrarResultados(false);
      return;
    }

    setBuscandoClientes(true);
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as Cliente[];
      setClientesResultados(data);
      setMostrarResultados(true);
    } catch {
      setClientesResultados([]);
    } finally {
      setBuscandoClientes(false);
    }
  }

  useEffect(() => {
    const query = cliente.trim() || clienteCi.trim();
    if (query.length < 4) {
      return;
    }

    const timeout = setTimeout(() => {
      buscarClientes(query);
    }, 400);

    return () => clearTimeout(timeout);
  }, [cliente, clienteCi]);

  const puedeMostrarResultados =
    mostrarResultados && (cliente.trim().length >= 4 || clienteCi.trim().length >= 4);

  function seleccionarCliente(c: Cliente) {
    setCliente(c.nombre);
    setClienteCi(c.cedula ?? "");
    setDireccion(c.direccion ?? "");
    setMostrarResultados(false);
  }

  const productosById = useMemo(() => {
    const map = new Map<number, Producto>();
    productos.forEach((p) => map.set(p.id, p));
    return map;
  }, [productos]);

  const tasa = Number(tasaDelDia) || 0;

  const totales = useMemo(() => {
    let ventaTotalUsd = 0;

    for (const item of items) {
      const producto = productosById.get(Number(item.productoId));
      const cantidad = Number(item.cantidad) || 0;
      if (!producto) continue;
      const extra = producto.extras.find((ex) => String(ex.id) === item.extraId);
      const precioUnit = producto.precioVenta + (extra?.precioAdicional ?? 0);
      ventaTotalUsd += precioUnit * cantidad;
    }

    const costoDeliveryUsd = Number(costoDelivery) || 0;
    const totalAPagarUsd = ventaTotalUsd + costoDeliveryUsd;

    // Resuelve cada pago en orden: los pagos automáticos toman el restante
    // (en $) después de descontar los pagos previos, y los manuales se
    // convierten a $ según su moneda para descontarlos del restante.
    let restanteUsd = totalAPagarUsd;
    const resueltosUsd: number[] = [];
    for (const pago of pagos) {
      if (!pago.metodo) {
        resueltosUsd.push(0);
        continue;
      }

      let montoUsd: number;
      if (pago.montoAuto) {
        montoUsd = restanteUsd;
      } else {
        const montoRaw = Number(pago.monto) || 0;
        montoUsd = METODOS_PAGO_USD.includes(pago.metodo) ? montoRaw : bsToUsd(montoRaw, tasa);
      }

      resueltosUsd.push(montoUsd);
      restanteUsd -= montoUsd;
    }

    const montoSugerido = (index: number) => {
      const metodo = pagos[index]?.metodo;
      if (!metodo) return 0;
      const montoUsd = resueltosUsd[index];
      return METODOS_PAGO_USD.includes(metodo) ? montoUsd : usdToBs(montoUsd, tasa);
    };

    let totalPagosBs = 0;
    let totalPagosUsd = 0;
    pagos.forEach((pago, index) => {
      if (!pago.metodo) return;
      const monto = pago.montoAuto ? montoSugerido(index) : Number(pago.monto) || 0;
      if (METODOS_PAGO_USD.includes(pago.metodo)) {
        totalPagosUsd += monto;
      } else {
        totalPagosBs += monto;
      }
    });

    const totalPagos = totalPagosBs + totalPagosUsd * tasa;
    const totalPagosEnUsd = totalPagosUsd + bsToUsd(totalPagosBs, tasa);

    return {
      ventaTotalUsd,
      costoDeliveryUsd,
      totalAPagarUsd,
      totalPagos,
      totalPagosEnUsd,
      ventaTotalBs: usdToBs(ventaTotalUsd, tasa),
      costoDeliveryBs: usdToBs(costoDeliveryUsd, tasa),
      totalAPagarBs: usdToBs(totalAPagarUsd, tasa),
      montoSugerido,
    };
  }, [items, pagos, productosById, tasa, costoDelivery]);

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
    setPagos((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        return { ...p, ...patch };
      })
    );
  }

  function addPago() {
    setPagos((prev) => [...prev, { ...EMPTY_PAGO }]);
  }

  function removePago(index: number) {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConsultarTasaBcv() {
    setTasaBcvError(null);
    setConsultandoTasa(true);
    try {
      const res = await fetch("/api/tasa-bcv");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo consultar la tasa BCV");
      }
      setTasaDelDia(String(data.tasa));
      setTasaBcvFecha(data.fecha);
    } catch (err) {
      setTasaBcvError(
        err instanceof Error ? err.message : "No se pudo consultar la tasa BCV"
      );
    } finally {
      setConsultandoTasa(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setFecha(today());
    setCliente("");
    setClienteCi("");
    setDireccion("");
    setModalidadCompra("");
    setModoEntrega("LOCAL");
    setCostoDelivery("0");
    setObservaciones("");
    setItems([{ ...EMPTY_ITEM }]);
    setPagos([{ ...EMPTY_PAGO }]);
  }

  function startEdit(venta: Venta) {
    setEditingId(venta.id);
    setFecha(String(venta.fecha).slice(0, 10));
    setTasaDelDia(String(venta.tasaDelDia));
    setCliente(venta.cliente);
    setClienteCi(venta.clienteCi ?? "");
    setDireccion(venta.direccion ?? "");
    setModalidadCompra(venta.modalidadCompra ?? "");
    setModoEntrega(venta.modoEntrega);
    setCostoDelivery(String(venta.costoDelivery));
    setObservaciones(venta.observaciones ?? "");
    setItems(
      venta.items.map((item) => ({
        productoId: String(item.productoId),
        cantidad: String(item.cantidad),
        extraId: item.extraId ? String(item.extraId) : "",
      }))
    );
    setPagos(
      venta.pagos.length
        ? venta.pagos.map((pago) => ({
            metodo: pago.metodo,
            monto: String(pago.monto),
            montoAuto: false,
          }))
        : [{ ...EMPTY_PAGO }]
    );
  }

  function cancelEdit() {
    resetForm();
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

    const validPagos = pagos
      .map((p, index) => ({
        metodo: p.metodo,
        monto: p.montoAuto ? totales.montoSugerido(index) : Number(p.monto) || 0,
      }))
      .filter((p): p is { metodo: MetodoPago; monto: number } => !!p.metodo && p.monto > 0);

    setSaving(true);
    try {
      const payload = {
        fecha,
        tasaDelDia: Number(tasaDelDia) || 0,
        cliente: cliente.trim(),
        clienteCi: clienteCi.trim(),
        direccion: direccion.trim(),
        modalidadCompra: modalidadCompra.trim(),
        modoEntrega,
        costoDelivery: Number(costoDelivery) || 0,
        observaciones: observaciones.trim(),
        items: validItems.map((i) => ({
          productoId: Number(i.productoId),
          cantidad: Number(i.cantidad),
          extraId: i.extraId ? Number(i.extraId) : null,
        })),
        pagos: validPagos,
      };

      const res = await fetch(
        editingId ? `/api/ventas/${editingId}` : "/api/ventas",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

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
            <div className="flex gap-1">
              <input
                type="number"
                step="0.0001"
                min="0"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={tasaDelDia}
                onChange={(e) => setTasaDelDia(e.target.value)}
                placeholder="0.00"
              />
              <button
                type="button"
                onClick={handleConsultarTasaBcv}
                disabled={consultandoTasa}
                title="Consultar tasa oficial BCV"
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
              >
                {consultandoTasa ? "..." : "BCV"}
              </button>
            </div>
            {tasaBcvFecha && (
              <span className="text-xs text-zinc-500">
                BCV: {new Date(tasaBcvFecha).toLocaleDateString("es-VE")}
              </span>
            )}
            {tasaBcvError && (
              <span className="text-xs text-red-600">{tasaBcvError}</span>
            )}
          </div>
          <div className="relative flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Cliente</label>
            <div className="flex gap-1">
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                onFocus={() => clientesResultados.length > 0 && setMostrarResultados(true)}
                placeholder="Nombre del cliente"
                required
              />
              <button
                type="button"
                onClick={() => buscarClientes(cliente || clienteCi)}
                disabled={buscandoClientes}
                title="Buscar cliente"
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
              >
                {buscandoClientes ? "..." : "Buscar"}
              </button>
            </div>
            {puedeMostrarResultados && clientesResultados.length > 0 && (
              <ul className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                {clientesResultados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-100"
                    >
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-xs text-zinc-500">
                        {c.cedula ?? "Sin C.I/ID"}
                        {c.direccion ? ` · ${c.direccion}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">C.I/ID</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={clienteCi}
              onChange={(e) => setClienteCi(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">Dirección</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Opcional"
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
              const extra = producto?.extras.find((ex) => String(ex.id) === item.extraId);
              const precioUnit = producto ? producto.precioVenta + (extra?.precioAdicional ?? 0) : 0;
              return (
                <div key={index} className="grid grid-cols-12 items-center gap-2">
                  <select
                    className="col-span-6 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-4"
                    value={item.productoId}
                    onChange={(e) => updateItem(index, { productoId: e.target.value, extraId: "" })}
                  >
                    <option value="">Selecciona un producto</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3"
                    value={item.extraId}
                    onChange={(e) => updateItem(index, { extraId: e.target.value })}
                    disabled={!producto || producto.extras.length === 0}
                  >
                    <option value="">Sin extra</option>
                    {producto?.extras.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.nombre} (+{ex.precioAdicional.toFixed(2)})
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
                    {producto ? (precioUnit * cantidad).toFixed(2) : "-"}
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
                  onChange={(e) =>
                    updatePago(index, {
                      metodo: e.target.value as MetodoPago | "",
                      montoAuto: true,
                    })
                  }
                >
                  <option value="">Selecciona forma de pago</option>
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
                  value={
                    pago.montoAuto
                      ? pago.metodo
                        ? totales.montoSugerido(index).toFixed(2)
                        : ""
                      : pago.monto
                  }
                  onChange={(e) => updatePago(index, { monto: e.target.value, montoAuto: false })}
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

        <div className="grid grid-cols-1 gap-2 rounded-md bg-zinc-50 p-3 text-sm sm:grid-cols-2">
          <div>
            <span className="font-medium text-zinc-600">Total venta: </span>
            {totales.ventaTotalBs.toFixed(2)} Bs{" "}
            <span className="text-zinc-500">(${totales.ventaTotalUsd.toFixed(2)})</span>
          </div>
          {modoEntrega === "DELIVERY" && (
            <div>
              <span className="font-medium text-zinc-600">Costo delivery: </span>
              {totales.costoDeliveryBs.toFixed(2)} Bs{" "}
              <span className="text-zinc-500">(${totales.costoDeliveryUsd.toFixed(2)})</span>
            </div>
          )}
          <div>
            <span className="font-medium text-zinc-600">Total a pagar: </span>
            {totales.totalAPagarBs.toFixed(2)} Bs{" "}
            <span className="text-zinc-500">(${totales.totalAPagarUsd.toFixed(2)})</span>
          </div>
          <div>
            <span className="font-medium text-zinc-600">Total pagado: </span>
            {totales.totalPagos.toFixed(2)} Bs{" "}
            <span className="text-zinc-500">(${totales.totalPagosEnUsd.toFixed(2)})</span>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {editingId ? "Guardar cambios" : "Registrar venta"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancelar
            </button>
          )}
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
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Total venta</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Delivery</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Total pagado</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Entrega</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && ventas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-zinc-500">
                  No hay ventas registradas
                </td>
              </tr>
            )}
            {ventas.map((venta) => {
              const ventaTotalUsd = venta.items.reduce(
                (acc, i) => acc + i.precioUnit * i.cantidad,
                0
              );
              const costoDeliveryUsd = venta.costoDelivery;

              let totalPagadoBs = 0;
              let totalPagadoUsd = 0;
              for (const pago of venta.pagos) {
                if (METODOS_PAGO_USD.includes(pago.metodo)) {
                  totalPagadoUsd += pago.monto;
                } else {
                  totalPagadoBs += pago.monto;
                }
              }
              const totalPagadoEnBs = totalPagadoBs + usdToBs(totalPagadoUsd, venta.tasaDelDia);
              const totalPagadoEnUsd = totalPagadoUsd + bsToUsd(totalPagadoBs, venta.tasaDelDia);

              return (
                <tr key={venta.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(venta.fecha).toLocaleDateString("es-VE")}
                  </td>
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{venta.cliente}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {venta.items
                      .map(
                        (i) =>
                          `${i.nombreProducto}${i.extraNombre ? ` (${i.extraNombre})` : ""} x${i.cantidad}`
                      )
                      .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">
                    {venta.pagos
                      .map((p) => `${METODO_PAGO_LABELS[p.metodo]}: ${p.monto.toFixed(2)}`)
                      .join(", ") || "-"}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {usdToBs(ventaTotalUsd, venta.tasaDelDia).toFixed(2)} Bs{" "}
                    <span className="text-zinc-500">(${ventaTotalUsd.toFixed(2)})</span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {costoDeliveryUsd > 0 ? (
                      <>
                        {usdToBs(costoDeliveryUsd, venta.tasaDelDia).toFixed(2)} Bs{" "}
                        <span className="text-zinc-500">(${costoDeliveryUsd.toFixed(2)})</span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {totalPagadoEnBs.toFixed(2)} Bs{" "}
                    <span className="text-zinc-500">(${totalPagadoEnUsd.toFixed(2)})</span>
                  </td>
                  <td className="px-4 py-2">
                    {venta.modoEntrega === "DELIVERY" ? "Delivery" : "Local"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(venta)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(venta.id)}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </div>
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

"use client";

import { useEffect, useMemo, useState } from "react";
import type { Cliente, Producto, VentaPendientePago } from "@/lib/types";
import { ajustarCantidadConFlechas } from "@/lib/cantidad";
import { validarCedulaRif } from "@/lib/validacion";

type NotaItem = {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
};

const EMPTY_ITEM: NotaItem = { descripcion: "", cantidad: "1", precioUnitario: "" };
const FILAS_IMPRESION = 10;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function formatFechaDDMMYYYY(fecha: string) {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

export default function NotasEntregaTab({ productos }: { productos: Producto[] }) {
  const [fecha, setFecha] = useState(today());
  const [fechaLimitePago, setFechaLimitePago] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [cliente, setCliente] = useState("");
  const [clienteCi, setClienteCi] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [items, setItems] = useState<NotaItem[]>([
    { ...EMPTY_ITEM },
    { ...EMPTY_ITEM },
    { ...EMPTY_ITEM },
  ]);
  const [error, setError] = useState<string | null>(null);

  const [clientesResultados, setClientesResultados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [pedidosPendientes, setPedidosPendientes] = useState<VentaPendientePago[]>([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState("");

  useEffect(() => {
    async function loadPedidosPendientes() {
      try {
        const res = await fetch("/api/ventas/pendientes-pago");
        if (res.ok) {
          setPedidosPendientes((await res.json()) as VentaPendientePago[]);
        }
      } catch {
        // ignorar
      }
    }
    loadPedidosPendientes();
  }, []);

  function handleSeleccionPedido(value: string) {
    setPedidoSeleccionado(value);
    if (!value) return;

    const pedido = pedidosPendientes.find((p) => String(p.id) === value);
    if (!pedido) return;

    setCliente(pedido.cliente);
    setClienteCi(pedido.clienteCi ?? "");
    setClienteTelefono(pedido.clienteTelefono ?? "");
    setDireccion(pedido.direccion ?? "");
    setFechaLimitePago((pedido.fechaLimitePago ?? "").slice(0, 10));

    setItems(
      pedido.items.map((it) => ({
        descripcion: it.descripcion,
        cantidad: String(it.cantidad),
        precioUnitario: String(it.precioUnitario),
      }))
    );
  }

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
    setClienteTelefono(c.telefono ?? "");
    setDireccion(c.direccion ?? "");
    setMostrarResultados(false);
  }

  function updateItem(index: number, patch: Partial<NotaItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSeleccionProducto(index: number, nombre: string) {
    const producto = productos.find((p) => p.nombre === nombre);
    updateItem(index, {
      descripcion: nombre,
      precioUnitario: producto ? String(producto.precioVenta) : items[index].precioUnitario,
    });
  }

  const itemsConTotal = useMemo(
    () =>
      items.map((it) => {
        const cantidad = Number(it.cantidad) || 0;
        const precio = Number(it.precioUnitario) || 0;
        return { ...it, cantidad, precio, total: cantidad * precio };
      }),
    [items]
  );

  const totalGeneral = itemsConTotal.reduce((acc, it) => acc + it.total, 0);

  const filasImpresion = useMemo(() => {
    const filas = itemsConTotal.filter((it) => it.descripcion.trim() && it.cantidad > 0);
    const relleno = Math.max(0, FILAS_IMPRESION - filas.length);
    return [
      ...filas,
      ...Array.from({ length: relleno }, () => ({
        descripcion: "",
        cantidad: 0,
        precioUnitario: "",
        precio: 0,
        total: 0,
      })),
    ];
  }, [itemsConTotal]);

  function handleImprimir() {
    if (!cliente.trim()) {
      setError("El cliente es obligatorio");
      return;
    }

    const ciRifError = validarCedulaRif(clienteCi);
    if (ciRifError) {
      setError(ciRifError);
      return;
    }

    const itemsValidos = itemsConTotal.filter((it) => it.descripcion.trim() && it.cantidad > 0);
    if (itemsValidos.length === 0) {
      setError("Agrega al menos un producto con cantidad válida");
      return;
    }

    setError(null);
    window.print();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4 print:hidden">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">N° de pedido</label>
            <select
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={pedidoSeleccionado}
              onChange={(e) => handleSeleccionPedido(e.target.value)}
            >
              <option value="">Seleccionar pedido</option>
              {pedidosPendientes.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} — {p.cliente}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Fecha</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Fecha límite de pago</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={fechaLimitePago}
              onChange={(e) => setFechaLimitePago(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">N° de Factura</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              placeholder="Opcional"
            />
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
                        {c.cedula ?? "Sin C.I/Rif"}
                        {c.telefono ? ` · ${c.telefono}` : ""}
                        {c.direccion ? ` · ${c.direccion}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">C.I/Rif</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={clienteCi}
              onChange={(e) => setClienteCi(e.target.value)}
              placeholder="Ej: 12345678 o V12345678"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">Teléfono</label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
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
          <datalist id="productos-list-notas">
            {productos.map((p) => (
              <option key={p.id} value={p.nombre} />
            ))}
          </datalist>
          <div className="flex flex-col gap-2">
            {items.map((item, index) => {
              const cantidad = Number(item.cantidad) || 0;
              const precio = Number(item.precioUnitario) || 0;
              return (
                <div key={index} className="grid grid-cols-12 items-center gap-2">
                  <input
                    list="productos-list-notas"
                    className="col-span-6 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-6"
                    value={item.descripcion}
                    onChange={(e) => handleSeleccionProducto(index, e.target.value)}
                    placeholder="Selecciona o escribe una descripción"
                  />
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                    value={item.cantidad}
                    onChange={(e) =>
                      updateItem(index, {
                        cantidad: ajustarCantidadConFlechas(item.cantidad, e.target.value),
                      })
                    }
                    placeholder="Cantidad"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                    value={item.precioUnitario}
                    onChange={(e) => updateItem(index, { precioUnitario: e.target.value })}
                    placeholder="Precio"
                  />
                  <div className="col-span-1 text-right text-sm text-zinc-600 sm:col-span-1">
                    {(cantidad * precio).toFixed(2)}
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

        <div className="rounded-md bg-zinc-50 p-3 text-right text-sm">
          <span className="font-medium text-zinc-600">Total a pagar: </span>
          <span className="text-base font-semibold">${totalGeneral.toFixed(2)}</span>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleImprimir}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Imprimir orden de entrega
          </button>
        </div>
      </div>

      <div id="orden-entrega-print" className="hidden p-8 print:block">
        <div className="flex items-start justify-between border-b-2 border-black pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Logo" className="h-20 w-20 object-contain" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold">ORDEN DE ENTREGA</h1>
          </div>
          <div className="flex flex-col items-end gap-1 text-sm whitespace-nowrap">
            <div>Fecha {formatFechaDDMMYYYY(fecha)}</div>
            {numeroFactura && <div>N. de Factura: {numeroFactura}</div>}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-1 text-sm">
          <div>
            <span className="font-semibold">Cliente: </span>
            {cliente}
          </div>
          <div>
            <span className="font-semibold">Dirección: </span>
            {direccion}
          </div>
          <div>
            <span className="font-semibold">Rif: </span>
            {clienteCi}
          </div>
        </div>

        <table className="mt-4 w-full border border-black text-sm">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1">Cantidad</th>
              <th className="border border-black px-2 py-1">Descripción del Producto</th>
              <th className="border border-black px-2 py-1">Precio Unitario</th>
              <th className="border border-black px-2 py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {filasImpresion.map((it, index) => (
              <tr key={index}>
                <td className="border border-black px-2 py-1 text-center">
                  {it.cantidad ? it.cantidad : ""}
                </td>
                <td className="border border-black px-2 py-1">{it.descripcion}</td>
                <td className="border border-black px-2 py-1 text-right">
                  {it.precio ? `$${it.precio.toFixed(2)}` : ""}
                </td>
                <td className="border border-black px-2 py-1 text-right">
                  {it.total ? `$${it.total.toFixed(2)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-semibold">Fecha límite de pago: </span>
            {fechaLimitePago ? formatFechaDDMMYYYY(fechaLimitePago) : ""}
          </div>
          <div className="text-lg font-semibold">Total a Pagar ${totalGeneral.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

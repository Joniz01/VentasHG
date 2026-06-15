"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  METODOS_PAGO,
  METODOS_PAGO_USD,
  METODO_PAGO_LABELS,
  MODOS_ENTREGA,
  CLIENTES_CONFIG_DEFAULT,
  type MetodoPago,
  type ModoEntrega,
  type Cliente,
  type ClientesConfig,
  type Motorizado,
  type Producto,
  type Rol,
  type Venta,
} from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";
import { ajustarCantidadConFlechas } from "@/lib/cantidad";
import { validarCedulaRif, validarTelefono } from "@/lib/validacion";
import TimeInput12h from "@/components/TimeInput12h";
import NotasEntregaTab from "@/components/NotasEntregaTab";
import ClientesTab from "@/components/ClientesTab";

type ItemRow = {
  productoId: string;
  productoNombre: string;
  cantidad: string;
  extraId: string;
  variadaSelecciones: string[];
};
type PagoRow = { metodo: MetodoPago | ""; monto: string; montoAuto: boolean };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function addDays(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_ITEM: ItemRow = {
  productoId: "",
  productoNombre: "",
  cantidad: "1",
  extraId: "",
  variadaSelecciones: [],
};
const EMPTY_PAGO: PagoRow = { metodo: "", monto: "", montoAuto: true };

function bsToUsd(montoBs: number, tasa: number) {
  return tasa > 0 ? montoBs / tasa : 0;
}

function usdToBs(montoUsd: number, tasa: number) {
  return montoUsd * tasa;
}

const pad = (n: number) => String(n).padStart(2, "0");

function combinarFechaHora(fecha: string, hora: string): Date | null {
  if (!fecha || !hora) return null;
  const date = new Date(`${fecha}T${hora}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

type Props = {
  rol?: Rol | null;
};

export default function VentasClient({ rol = null }: Props) {
  const [vista, setVista] = useState<"ventas" | "notas" | "clientes">("ventas");
  const [clientesConfig, setClientesConfig] = useState<ClientesConfig>(CLIENTES_CONFIG_DEFAULT);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [fecha, setFecha] = useState(today());
  const [tasaDelDia, setTasaDelDia] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteApellido, setClienteApellido] = useState("");
  const [clienteCi, setClienteCi] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [modalidadCompra, setModalidadCompra] = useState("");
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>("LOCAL");
  const [costoDelivery, setCostoDelivery] = useState("0");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [pagos, setPagos] = useState<PagoRow[]>([{ ...EMPTY_PAGO }]);
  const [diasCredito, setDiasCredito] = useState("");
  const [fechaLimitePago, setFechaLimitePago] = useState("");
  const [mostrarCuentaPorCobrar, setMostrarCuentaPorCobrar] = useState(false);
  const [errorPlazoPago, setErrorPlazoPago] = useState(false);
  const [despachoPendiente, setDespachoPendiente] = useState(false);
  const [horaEntrega, setHoraEntrega] = useState("");
  const [minutosPrep, setMinutosPrep] = useState("15");
  const [minutosPrepCustom, setMinutosPrepCustom] = useState("");
  const [minutosRetiro, setMinutosRetiro] = useState("10");
  const [minutosRetiroCustom, setMinutosRetiroCustom] = useState("");
  const [motorizadoId, setMotorizadoId] = useState("");
  const [tasaBcvFecha, setTasaBcvFecha] = useState<string | null>(null);
  const [tasaBcvError, setTasaBcvError] = useState<string | null>(null);
  const [consultandoTasa, setConsultandoTasa] = useState(false);

  const [clientesResultados, setClientesResultados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  async function loadData() {
    try {
      const [productosRes, ventasRes, motorizadosRes] = await Promise.all([
        fetch("/api/productos"),
        fetch("/api/ventas"),
        fetch("/api/motorizados"),
      ]);
      setProductos(await productosRes.json());
      setVentas(await ventasRes.json());
      setMotorizados(await motorizadosRes.json());
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

  useEffect(() => {
    async function loadClientesConfig() {
      try {
        const res = await fetch("/api/clientes-config");
        if (res.ok) {
          setClientesConfig((await res.json()) as ClientesConfig);
        }
      } catch {
        // se mantiene la configuración por defecto
      }
    }
    loadClientesConfig();
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
    const query = clienteNombre.trim() || clienteCi.trim();
    if (query.length < 4) {
      return;
    }

    const timeout = setTimeout(() => {
      buscarClientes(query);
    }, 400);

    return () => clearTimeout(timeout);
  }, [clienteNombre, clienteCi]);

  const puedeMostrarResultados =
    mostrarResultados && (clienteNombre.trim().length >= 4 || clienteCi.trim().length >= 4);

  function seleccionarCliente(c: Cliente) {
    setClienteNombre(c.nombre);
    setClienteApellido(c.apellido ?? "");
    setClienteCi(c.cedula ?? "");
    setClienteTelefono(c.telefono ?? "");
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

  const minutosPreparacionNum =
    minutosPrep === "otro" ? Number(minutosPrepCustom) || 0 : Number(minutosPrep);
  const minutosRetiroNum =
    minutosRetiro === "otro" ? Number(minutosRetiroCustom) || 0 : Number(minutosRetiro);

  const horaEntregaDate = combinarFechaHora(fecha, horaEntrega);
  const horaPreparacionDate = horaEntregaDate
    ? new Date(horaEntregaDate.getTime() - minutosPreparacionNum * 60000)
    : null;
  const horaRetiroDate = horaEntregaDate
    ? new Date(horaEntregaDate.getTime() - minutosRetiroNum * 60000)
    : null;

  const ventasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return ventas.filter((venta) => {
      if (soloPendientes && !(venta.despachoPendiente && !venta.pedidoEntregado)) return false;
      if (!term) return true;
      const idMatch = String(venta.id).includes(term) || `#${venta.id}`.includes(term);
      const clienteMatch = venta.cliente.toLowerCase().includes(term);
      return idMatch || clienteMatch;
    });
  }, [ventas, busqueda, soloPendientes]);

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
    setClienteNombre("");
    setClienteApellido("");
    setClienteCi("");
    setClienteTelefono("");
    setDireccion("");
    setModalidadCompra("");
    setModoEntrega("LOCAL");
    setCostoDelivery("0");
    setObservaciones("");
    setItems([{ ...EMPTY_ITEM }]);
    setPagos([{ ...EMPTY_PAGO }]);
    setDiasCredito("");
    setFechaLimitePago("");
    setMostrarCuentaPorCobrar(false);
    setErrorPlazoPago(false);
    setDespachoPendiente(false);
    setHoraEntrega("");
    setMinutosPrep("15");
    setMinutosPrepCustom("");
    setMinutosRetiro("10");
    setMinutosRetiroCustom("");
    setMotorizadoId("");
  }

  function startEdit(venta: Venta) {
    setEditingId(venta.id);
    setFecha(String(venta.fecha).slice(0, 10));
    setTasaDelDia(String(venta.tasaDelDia));
    setClienteNombre(venta.clienteNombre ?? venta.cliente);
    setClienteApellido(venta.clienteApellido ?? "");
    setClienteCi(venta.clienteCi ?? "");
    setClienteTelefono(venta.clienteTelefono ?? "");
    setDireccion(venta.direccion ?? "");
    setModalidadCompra(venta.modalidadCompra ?? "");
    setModoEntrega(venta.modoEntrega);
    setCostoDelivery(String(venta.costoDelivery));
    setObservaciones(venta.observaciones ?? "");
    setItems(
      venta.items.map((item) => ({
        productoId: String(item.productoId),
        productoNombre: item.nombreProducto,
        cantidad: String(item.cantidad),
        extraId: item.extraId ? String(item.extraId) : "",
        variadaSelecciones: (item.variadaSelecciones ?? []).map((s) => String(s.productoId)),
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
    setDiasCredito("");
    setFechaLimitePago(venta.cuentaPorCobrar ? (venta.fechaLimitePago ?? "").slice(0, 10) : "");
    setMostrarCuentaPorCobrar(venta.cuentaPorCobrar);
    setErrorPlazoPago(false);

    if (venta.despachoPendiente && venta.horaEntrega && venta.horaPreparacion) {
      const entregaDate = new Date(venta.horaEntrega);
      const prepDate = new Date(venta.horaPreparacion);
      setDespachoPendiente(true);
      setHoraEntrega(`${pad(entregaDate.getHours())}:${pad(entregaDate.getMinutes())}`);
      const diffMin = Math.round((entregaDate.getTime() - prepDate.getTime()) / 60000);
      if ([5, 15, 30].includes(diffMin)) {
        setMinutosPrep(String(diffMin));
        setMinutosPrepCustom("");
      } else {
        setMinutosPrep("otro");
        setMinutosPrepCustom(String(diffMin));
      }
      if (venta.horaRetiro) {
        const retiroDate = new Date(venta.horaRetiro);
        const diffRetiro = Math.round((entregaDate.getTime() - retiroDate.getTime()) / 60000);
        if ([5, 15, 30].includes(diffRetiro)) {
          setMinutosRetiro(String(diffRetiro));
          setMinutosRetiroCustom("");
        } else {
          setMinutosRetiro("otro");
          setMinutosRetiroCustom(String(diffRetiro));
        }
      } else {
        setMinutosRetiro("10");
        setMinutosRetiroCustom("");
      }
      setMotorizadoId(venta.motorizadoId ? String(venta.motorizadoId) : "");
    } else {
      setDespachoPendiente(false);
      setHoraEntrega("");
      setMinutosPrep("15");
      setMinutosPrepCustom("");
      setMinutosRetiro("10");
      setMinutosRetiroCustom("");
      setMotorizadoId("");
    }
  }

  function cancelEdit() {
    resetForm();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clienteNombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }

    const ciRifError = validarCedulaRif(clienteCi);
    if (ciRifError) {
      setError(ciRifError);
      return;
    }

    const telefonoError = validarTelefono(clienteTelefono);
    if (telefonoError) {
      setError(telefonoError);
      return;
    }

    if (clientesConfig.apellidoObligatorio && !clienteApellido.trim()) {
      setError("El apellido del cliente es obligatorio");
      return;
    }

    if (clientesConfig.cedulaObligatoria && !clienteCi.trim()) {
      setError("El C.I/Rif del cliente es obligatorio");
      return;
    }

    if (clientesConfig.telefonoObligatorio && !clienteTelefono.trim()) {
      setError("El teléfono del cliente es obligatorio");
      return;
    }

    if (clientesConfig.direccionObligatoria && !direccion.trim()) {
      setError("La dirección del cliente es obligatoria");
      return;
    }

    const validItems = items.filter((i) => i.productoId && Number(i.cantidad) > 0);
    if (validItems.length === 0) {
      setError("Agrega al menos un producto con cantidad válida");
      return;
    }

    for (const item of validItems) {
      const producto = productosById.get(Number(item.productoId));
      if (producto?.tipoProducto === "VARIADA") {
        const seleccionesValidas = item.variadaSelecciones.filter((s) => s);
        if (seleccionesValidas.length !== producto.variadaRaciones) {
          setError(
            `Selecciona las ${producto.variadaRaciones} raciones de "${producto.nombre}"`
          );
          return;
        }
      }
    }

    const validPagos = pagos
      .map((p, index) => ({
        metodo: p.metodo,
        monto: p.montoAuto ? totales.montoSugerido(index) : Number(p.monto) || 0,
      }))
      .filter((p): p is { metodo: MetodoPago; monto: number } => !!p.metodo && p.monto > 0);

    if (despachoPendiente && (!horaEntregaDate || !horaPreparacionDate)) {
      setError("Indica la hora de entrega para el despacho pendiente");
      return;
    }

    if (validPagos.length === 0 && !fechaLimitePago) {
      setMostrarCuentaPorCobrar(true);
      setErrorPlazoPago(true);
      setError("Registre el Plazo de pago");
      return;
    }
    setErrorPlazoPago(false);

    setSaving(true);
    try {
      const payload = {
        fecha,
        tasaDelDia: Number(tasaDelDia) || 0,
        cliente: `${clienteNombre.trim()} ${clienteApellido.trim()}`.trim(),
        clienteNombre: clienteNombre.trim(),
        clienteApellido: clienteApellido.trim(),
        clienteCi: clienteCi.trim(),
        clienteTelefono: clienteTelefono.trim(),
        direccion: direccion.trim(),
        modalidadCompra: modalidadCompra.trim(),
        modoEntrega,
        costoDelivery: Number(costoDelivery) || 0,
        observaciones: observaciones.trim(),
        despachoPendiente,
        horaEntrega: despachoPendiente && horaEntregaDate ? horaEntregaDate.toISOString() : null,
        horaPreparacion:
          despachoPendiente && horaPreparacionDate ? horaPreparacionDate.toISOString() : null,
        horaRetiro: despachoPendiente && horaRetiroDate ? horaRetiroDate.toISOString() : null,
        motorizadoId: despachoPendiente && motorizadoId ? Number(motorizadoId) : null,
        items: validItems.map((i) => ({
          productoId: Number(i.productoId),
          cantidad: Number(i.cantidad),
          extraId: i.extraId ? Number(i.extraId) : null,
          variadaSelecciones: i.variadaSelecciones.filter((s) => s).map(Number),
        })),
        pagos: validPagos,
        fechaLimitePago: validPagos.length === 0 ? fechaLimitePago : null,
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

  async function handleToggleCuentaCobrada(venta: Venta) {
    try {
      const res = await fetch(`/api/reportes/cuentas-por-cobrar/${venta.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuentaCobrada: !venta.cuentaCobrada }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al actualizar el cobro");
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar el cobro");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setVista("ventas")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            vista === "ventas"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          Registro de Ventas
        </button>
        <button
          type="button"
          onClick={() => setVista("notas")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            vista === "notas"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          Notas de Entrega
        </button>
        <button
          type="button"
          onClick={() => setVista("clientes")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            vista === "clientes"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          Clientes
        </button>
      </div>

      {vista === "notas" && <NotasEntregaTab productos={productos} />}

      {vista === "clientes" && <ClientesTab rol={rol} />}

      {vista === "ventas" && (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-3 rounded-md border border-blue-100 bg-blue-50/60 p-3">
        <h3 className="text-sm font-semibold text-blue-800">Información del cliente</h3>
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
                BCV: {formatFecha(tasaBcvFecha)}
              </span>
            )}
            {tasaBcvError && (
              <span className="text-xs text-red-600">{tasaBcvError}</span>
            )}
          </div>
          <div className="relative flex flex-col gap-1 sm:col-span-2">
            <div className="grid grid-cols-2 gap-1">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">
                  Nombre{clientesConfig.nombreObligatorio && " *"}
                </label>
                <div className="flex gap-1">
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    onFocus={() => clientesResultados.length > 0 && setMostrarResultados(true)}
                    placeholder="Nombre"
                    required={clientesConfig.nombreObligatorio}
                  />
                  <button
                    type="button"
                    onClick={() => buscarClientes(clienteNombre || clienteCi)}
                    disabled={buscandoClientes}
                    title="Buscar cliente"
                    className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {buscandoClientes ? "..." : "Buscar"}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">
                  Apellido{clientesConfig.apellidoObligatorio && " *"}
                </label>
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={clienteApellido}
                  onChange={(e) => setClienteApellido(e.target.value)}
                  placeholder="Apellido"
                  required={clientesConfig.apellidoObligatorio}
                />
              </div>
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
                      <span className="font-medium">
                        {c.nombre} {c.apellido ?? ""}
                      </span>
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
            <label className="text-sm font-medium text-zinc-700">
              C.I/Rif{clientesConfig.cedulaObligatoria && " *"}
            </label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={clienteCi}
              onChange={(e) => setClienteCi(e.target.value)}
              placeholder="Ej: 12345678 o V12345678"
              required={clientesConfig.cedulaObligatoria}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">
              Teléfono{clientesConfig.telefonoObligatorio && " *"}
            </label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              placeholder="Ej: 584129002211"
              required={clientesConfig.telefonoObligatorio}
            />
            <span className="text-xs text-zinc-500">
              Formato: código de país + número, sin espacios ni símbolos (Ej: 584129002211)
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-zinc-700">
              Dirección{clientesConfig.direccionObligatoria && " *"}
            </label>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={clientesConfig.direccionObligatoria ? "" : "Opcional"}
              required={clientesConfig.direccionObligatoria}
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
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-blue-100 bg-blue-50/60 p-3">
          <h3 className="text-sm font-semibold text-blue-800">Parámetros de entrega</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Modo de entrega</label>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={modoEntrega}
                onChange={(e) => setModoEntrega(e.target.value as ModoEntrega)}
              >
                {MODOS_ENTREGA.map((m) => (
                  <option key={m} value={m}>
                    {m === "DELIVERY" ? "Delivery" : "Local"}
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
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700">¿Despacho pendiente?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDespachoPendiente(true)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  despachoPendiente
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setDespachoPendiente(false)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  !despachoPendiente
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 hover:bg-zinc-100"
                }`}
              >
                No
              </button>
            </div>
          </div>

          {despachoPendiente && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Hora de entrega</label>
                <TimeInput12h value={horaEntrega} onChange={setHoraEntrega} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Avisar preparar</label>
                <select
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={minutosPrep}
                  onChange={(e) => setMinutosPrep(e.target.value)}
                >
                  <option value="5">5 min antes</option>
                  <option value="15">15 min antes</option>
                  <option value="30">30 min antes</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {minutosPrep === "otro" && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700">Minutos antes</label>
                  <input
                    type="number"
                    min="1"
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={minutosPrepCustom}
                    onChange={(e) => setMinutosPrepCustom(e.target.value)}
                    placeholder="Ej: 20"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Avisar hora de retiro</label>
                <select
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={minutosRetiro}
                  onChange={(e) => setMinutosRetiro(e.target.value)}
                >
                  <option value="5">5 min antes</option>
                  <option value="10">10 min antes</option>
                  <option value="15">15 min antes</option>
                  <option value="30">30 min antes</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              {minutosRetiro === "otro" && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-zinc-700">Minutos antes</label>
                  <input
                    type="number"
                    min="1"
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={minutosRetiroCustom}
                    onChange={(e) => setMinutosRetiroCustom(e.target.value)}
                    placeholder="Ej: 10"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Delivery asignado</label>
                <select
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={motorizadoId}
                  onChange={(e) => setMotorizadoId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {motorizados.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.apellido ? `${m.nombre} ${m.apellido}` : m.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {horaPreparacionDate && (
                <div className="flex flex-col justify-end text-sm text-zinc-600 sm:col-span-4">
                  La alarma de preparación sonará a las{" "}
                  <span className="font-medium">
                    {pad(horaPreparacionDate.getHours())}:{pad(horaPreparacionDate.getMinutes())}
                  </span>
                </div>
              )}
              {horaRetiroDate && (
                <div className="flex flex-col justify-end text-sm text-zinc-600 sm:col-span-4">
                  La alarma de retiro sonará a las{" "}
                  <span className="font-medium">
                    {pad(horaRetiroDate.getHours())}:{pad(horaRetiroDate.getMinutes())}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <h3 className="text-sm font-semibold text-zinc-700">Producto y forma de pago</h3>
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
          <datalist id="productos-list">
            {productos.map((p) => (
              <option key={p.id} value={p.nombre} />
            ))}
          </datalist>
          <div className="flex flex-col gap-2">
            {items.map((item, index) => {
              const producto = productosById.get(Number(item.productoId));
              const cantidad = Number(item.cantidad) || 0;
              const extra = producto?.extras.find((ex) => String(ex.id) === item.extraId);
              const precioUnit = producto ? producto.precioVenta + (extra?.precioAdicional ?? 0) : 0;
              return (
                <div key={index} className="grid grid-cols-12 items-center gap-2">
                  <input
                    list="productos-list"
                    className="col-span-6 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-4"
                    value={item.productoNombre}
                    onChange={(e) => {
                      const value = e.target.value;
                      const match = productos.find((p) => p.nombre === value);
                      updateItem(index, {
                        productoNombre: value,
                        productoId: match ? String(match.id) : "",
                        extraId: "",
                        variadaSelecciones:
                          match?.tipoProducto === "VARIADA"
                            ? Array.from({ length: match.variadaRaciones }, () => "")
                            : [],
                      });
                    }}
                    placeholder="Selecciona o escribe un producto"
                  />
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
                    step="1"
                    min="0"
                    className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
                    value={item.cantidad}
                    onChange={(e) =>
                      updateItem(index, {
                        cantidad: ajustarCantidadConFlechas(item.cantidad, e.target.value),
                      })
                    }
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
                  {producto?.tipoProducto === "VARIADA" && (
                    <div className="col-span-12 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      <span className="text-xs font-medium text-zinc-600">Raciones:</span>
                      {item.variadaSelecciones.map((seleccion, racionIndex) => (
                        <select
                          key={racionIndex}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                          value={seleccion}
                          onChange={(e) => {
                            const nuevasSelecciones = [...item.variadaSelecciones];
                            nuevasSelecciones[racionIndex] = e.target.value;
                            updateItem(index, { variadaSelecciones: nuevasSelecciones });
                          }}
                        >
                          <option value="">Selecciona ración {racionIndex + 1}</option>
                          {productos
                            .filter((p) => p.tipoProducto === "NORMAL")
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} (stock: {p.stockActual})
                              </option>
                            ))}
                        </select>
                      ))}
                    </div>
                  )}
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

        {pagos.every((p) => !p.metodo) && (
          <div
            className={`rounded-md border p-3 ${
              errorPlazoPago ? "border-red-300 bg-red-50" : "border-blue-300 bg-blue-200"
            }`}
          >
            <button
              type="button"
              onClick={() => setMostrarCuentaPorCobrar((prev) => !prev)}
              className={`flex w-full items-center justify-between text-left text-sm font-semibold ${
                errorPlazoPago ? "text-red-800" : "text-blue-900"
              }`}
            >
              <span>Cuenta por cobrar: indica el plazo de pago</span>
              <span className="text-xs">{mostrarCuentaPorCobrar ? "▲" : "▼"}</span>
            </button>
            {errorPlazoPago && (
              <p className="mt-1 text-xs font-medium text-red-700">Registre el Plazo de pago</p>
            )}
            {mostrarCuentaPorCobrar && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-600">Días de crédito</label>
                  <input
                    type="number"
                    min="0"
                    className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={diasCredito}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDiasCredito(value);
                      const dias = Number(value);
                      if (value && !Number.isNaN(dias) && fecha) {
                        setFechaLimitePago(addDays(fecha, dias));
                      }
                      setErrorPlazoPago(false);
                    }}
                    placeholder="Ej: 15"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-600">Fecha límite de pago</label>
                  <input
                    type="date"
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    value={fechaLimitePago}
                    onChange={(e) => {
                      setFechaLimitePago(e.target.value);
                      setDiasCredito("");
                      setErrorPlazoPago(false);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 rounded-md bg-white p-3 text-sm sm:grid-cols-2">
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por # de pedido o cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex-1 min-w-[200px] rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo pendientes por entregar
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pedido #</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Fecha</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Cliente</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Productos</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Pagos</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Total venta</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Delivery</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Total pagado</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-600">Entrega</th>
              <th className="px-4 py-2 text-center font-medium text-zinc-600">Cobro</th>
              <th className="px-4 py-2 text-right font-medium text-zinc-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-zinc-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && ventasFiltradas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-zinc-500">
                  No hay ventas registradas
                </td>
              </tr>
            )}
            {ventasFiltradas.map((venta) => {
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
                  <td className="px-4 py-2 whitespace-nowrap font-medium">#{venta.id}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {formatFecha(venta.fecha)}
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
                    {venta.despachoPendiente && !venta.pedidoEntregado ? (
                      <span className="rounded-md bg-zinc-900 px-2 py-1 font-bold text-white">
                        {venta.modoEntrega === "DELIVERY" ? "Delivery" : "Local"}
                      </span>
                    ) : venta.modoEntrega === "DELIVERY" ? (
                      "Delivery"
                    ) : (
                      "Local"
                    )}
                  </td>
                  <td className="px-4 py-2 text-center whitespace-nowrap">
                    {venta.cuentaPorCobrar ? (
                      <div className="flex flex-col items-center gap-1">
                        {venta.cuentaCobrada ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Pagada
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Pendiente
                          </span>
                        )}
                        <button
                          onClick={() => handleToggleCuentaCobrada(venta)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                        >
                          {venta.cuentaCobrada ? "Marcar pendiente" : "Marcar pagada"}
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
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
    </>
      )}
    </div>
  );
}

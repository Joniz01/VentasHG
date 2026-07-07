"use client";

import { useEffect, useMemo, useState, useCallback, useRef, FormEvent } from "react";
import Paginador from "@/components/Paginador";
import {
  METODOS_PAGO,
  METODOS_PAGO_USD,
  METODO_PAGO_LABELS,
  MODOS_ENTREGA,
  TIPOS_DELIVERY,
  TIPO_DELIVERY_LABELS,
  CLIENTES_CONFIG_DEFAULT,
  type MetodoPago,
  type ModoEntrega,
  type TipoDelivery,
  type Cliente,
  type ClientesConfig,
  type Motorizado,
  type Producto,
  type Rol,
  type Venta,
} from "@/lib/types";
import { formatFecha } from "@/lib/pedidos";
import { ajustarCantidadConFlechas } from "@/lib/cantidad";
import { validarCedulaRif } from "@/lib/validacion";
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

function startOfWeek(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.getDay();
  const diff = dia === 0 ? 6 : dia - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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
  puedeDescuento?: boolean;
};

export default function VentasClient({ rol = null, puedeDescuento = false }: Props) {
  const [vista, setVista] = useState<"ventas" | "historial" | "notas" | "clientes">("ventas");
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [porPaginaVentas, setPorPaginaVentas] = useState(25);
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
  const [cliente, setCliente] = useState("");
  const [clienteCi, setClienteCi] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [modalidadCompra, setModalidadCompra] = useState("");
  const [modoEntrega, setModoEntrega] = useState<ModoEntrega>("DELIVERY");
  const [tipoDelivery, setTipoDelivery] = useState<TipoDelivery>("EMPRESA");
  const [costoDelivery, setCostoDelivery] = useState("0");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState("0");
  const [winkCostoDefault, setWinkCostoDefault] = useState("3");
  const [casheaPorcentajes, setCasheaPorcentajes] = useState<string[]>(["50"]);
  const [casheaDiasOpciones, setCasheaDiasOpciones] = useState<string[]>(["15"]);
  const [casheaPorcentaje, setCasheaPorcentaje] = useState("50");
  const [casheaDiasSeleccion, setCasheaDiasSeleccion] = useState("15");
  const [casheaMetodoInicial, setCasheaMetodoInicial] = useState<string>("");
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

  // Modo de vista y secciones colapsables
  const [modoVista, setModoVista] = useState<"clasico" | "pasos">("clasico");
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(new Set(["paso1", "paso2", "paso3", "paso4"]));
  const [ventaHoy, setVentaHoy] = useState<number | null>(null);
  const [cxcPendiente, setCxcPendiente] = useState<number | null>(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  function toggleSeccion(key: string) {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function abrirSiguiente(actual: string) {
    const orden = ["paso1", "paso2", "paso3", "paso4"];
    const idx = orden.indexOf(actual);
    if (idx < 0 || idx >= orden.length - 1) return;
    setSeccionesAbiertas(prev => {
      const next = new Set(prev);
      next.delete(actual);
      next.add(orden[idx + 1]);
      return next;
    });
  }

  function expandirTodo() { setSeccionesAbiertas(new Set(["paso1", "paso2", "paso3", "paso4"])); }
  function colapsarTodo() { setSeccionesAbiertas(new Set()); }

  const [clientesResultados, setClientesResultados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [soloPendientesPago, setSoloPendientesPago] = useState(false);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(() => today());
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(() => today());

  const hayDatosIngresados = useCallback(() => {
    if (editingId !== null) return false;
    return (
      cliente.trim() !== "" ||
      clienteCi.trim() !== "" ||
      clienteTelefono.trim() !== "" ||
      observaciones.trim() !== "" ||
      items.some((i) => i.productoId !== "") ||
      pagos.some((p) => p.monto !== "")
    );
  }, [editingId, cliente, clienteCi, clienteTelefono, observaciones, items, pagos]);

  // Ref para que el guard de pushState siempre lea el valor actual sin re-registrarse
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = hayDatosIngresados();
  });

  // Guard para cierre/recarga de pestaña
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Guard para navegación client-side de Next.js (clicks en NavTabs)
  // Intercepta en fase de captura antes de que Next.js procese el click
  useEffect(() => {
    const MSG = "Tienes datos sin guardar. ¿Deseas salir y perder los cambios?";

    const handleClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // Solo links internos
      const isInternal = !href.startsWith("http") || href.startsWith(window.location.origin);
      if (!isInternal) return;
      if (!confirm(MSG)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

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
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.modo_entrega_default === "LOCAL" || cfg.modo_entrega_default === "DELIVERY") {
          setModoEntrega(cfg.modo_entrega_default as ModoEntrega);
        }
        if (cfg.wink_costo_default) {
          setWinkCostoDefault(cfg.wink_costo_default);
        }
        if (cfg.cashea_porcentajes) {
          const opts = cfg.cashea_porcentajes.split(",").map((s: string) => s.trim()).filter(Boolean);
          setCasheaPorcentajes(opts);
          const def = cfg.cashea_porcentaje_default ?? opts[0] ?? "50";
          setCasheaPorcentaje(def);
        }
        if (cfg.cashea_dias) {
          const opts = cfg.cashea_dias.split(",").map((s: string) => s.trim()).filter(Boolean);
          setCasheaDiasOpciones(opts);
          const def = cfg.cashea_dias_default ?? opts[0] ?? "15";
          setCasheaDiasSeleccion(def);
        }
        // Modo de vista y secciones
        if (cfg.ventas_modo_vista === "pasos") {
          setModoVista("pasos");
          const mobile = typeof window !== "undefined" && window.innerWidth < 640;
          if (mobile) {
            setSeccionesAbiertas(new Set());
          } else {
            const abiertas = new Set<string>();
            if (cfg.ventas_paso1_abierto !== "false") abiertas.add("paso1");
            if (cfg.ventas_paso2_abierto !== "false") abiertas.add("paso2");
            if (cfg.ventas_paso3_abierto !== "false") abiertas.add("paso3");
            if (cfg.ventas_paso4_abierto !== "false") abiertas.add("paso4");
            setSeccionesAbiertas(abiertas);
          }
        }
      })
      .catch(() => {});
    // Cargar indicadores de hoy y CxC
    fetch("/api/resumen")
      .then((r) => r.json())
      .then((d) => {
        if (d?.hoy?.total_usd != null) setVentaHoy(Number(d.hoy.total_usd));
        if (d?.cxcPendiente?.total_usd != null) setCxcPendiente(Number(d.cxcPendiente.total_usd));
      })
      .catch(() => {});
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

    const descuento = Math.min(Math.max(Number(descuentoPorcentaje) || 0, 0), 100);
    const ventaTotalConDescuentoUsd = ventaTotalUsd * (1 - descuento / 100);
    const costoDeliveryUsd = Number(costoDelivery) || 0;
    const totalAPagarUsd = ventaTotalConDescuentoUsd + costoDeliveryUsd;

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
      ventaTotalConDescuentoUsd,
      descuento,
      costoDeliveryUsd,
      totalAPagarUsd,
      totalPagos,
      totalPagosEnUsd,
      ventaTotalBs: usdToBs(ventaTotalUsd, tasa),
      ventaTotalConDescuentoBs: usdToBs(ventaTotalConDescuentoUsd, tasa),
      costoDeliveryBs: usdToBs(costoDeliveryUsd, tasa),
      totalAPagarBs: usdToBs(totalAPagarUsd, tasa),
      montoSugerido,
    };
  }, [items, pagos, productosById, tasa, costoDelivery, descuentoPorcentaje]);

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

      if (soloPendientesPago) {
        if (!(venta.cuentaPorCobrar && !venta.cuentaCobrada)) return false;
      } else if (filtroFechaDesde && filtroFechaHasta) {
        const fechaVenta = String(venta.fecha).slice(0, 10);
        if (fechaVenta < filtroFechaDesde || fechaVenta > filtroFechaHasta) return false;
      }

      if (!term) return true;
      const idMatch = String(venta.id).includes(term) || `#${venta.id}`.includes(term);
      const clienteMatch = venta.cliente.toLowerCase().includes(term);
      return idMatch || clienteMatch;
    });
  }, [ventas, busqueda, soloPendientes, soloPendientesPago, filtroFechaDesde, filtroFechaHasta]);

  function handleFiltroHoy() {
    const hoy = today();
    setFiltroFechaDesde(hoy);
    setFiltroFechaHasta(hoy);
  }

  function handleFiltroAyer() {
    const ayer = addDays(today(), -1);
    setFiltroFechaDesde(ayer);
    setFiltroFechaHasta(ayer);
  }

  function handleFiltroSemana() {
    const hoy = today();
    setFiltroFechaDesde(startOfWeek(hoy));
    setFiltroFechaHasta(hoy);
  }

  function handleFiltroMes() {
    const hoy = today();
    setFiltroFechaDesde(startOfMonth(hoy));
    setFiltroFechaHasta(hoy);
  }

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
    setClienteTelefono("");
    setDireccion("");
    setModalidadCompra("");
    setModoEntrega("DELIVERY");
    setTipoDelivery("EMPRESA");
    setCostoDelivery("0");
    setDescuentoPorcentaje("0");
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
    setCasheaPorcentaje(casheaPorcentajes[0] ?? "50");
    setCasheaDiasSeleccion(casheaDiasOpciones[0] ?? "15");
  }

  function startEdit(venta: Venta) {
    setEditingId(venta.id);
    setFecha(String(venta.fecha).slice(0, 10));
    setTasaDelDia(String(venta.tasaDelDia));
    setCliente(venta.cliente);
    setClienteCi(venta.clienteCi ?? "");
    setClienteTelefono(venta.clienteTelefono ?? "");
    setDireccion(venta.direccion ?? "");
    setModalidadCompra(venta.modalidadCompra ?? "");
    setModoEntrega(venta.modoEntrega);
    setTipoDelivery((venta.tipoDelivery as TipoDelivery) ?? "EMPRESA");
    setCostoDelivery(String(venta.costoDelivery));
    setDescuentoPorcentaje(String(venta.descuentoPorcentaje ?? 0));
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

    if (!cliente.trim()) {
      setError("El cliente es obligatorio");
      return;
    }

    const ciRifError = validarCedulaRif(clienteCi);
    if (ciRifError) {
      setError(ciRifError);
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
        cliente: cliente.trim(),
        clienteCi: clienteCi.trim(),
        clienteTelefono: clienteTelefono.trim(),
        direccion: direccion.trim(),
        modalidadCompra: modalidadCompra.trim(),
        modoEntrega,
        tipoDelivery: modoEntrega === "DELIVERY" ? tipoDelivery : null,
        costoDelivery: modoEntrega === "DELIVERY" ? Number(costoDelivery) || 0 : 0,
        descuentoPorcentaje: puedeDescuento ? Number(descuentoPorcentaje) || 0 : 0,
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
        casheaDatos: validPagos.some((p) => p.metodo === "CASHEA")
          ? (() => {
              const pct = Number(casheaPorcentaje) || 50;
              const dias = Number(casheaDiasSeleccion) || 15;
              const totalVenta = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
              const montoInicial = totalVenta * (pct / 100);
              const montoFinanciado = totalVenta - montoInicial;
              const fechaVenc = addDays(fecha, dias);
              return { porcentaje: pct, montoInicial, montoFinanciado, dias, fechaVencimiento: fechaVenc, metodoInicial: casheaMetodoInicial || null };
            })()
          : null,
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
          onClick={() => setVista("historial")}
          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
            vista === "historial"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 hover:bg-zinc-100"
          }`}
        >
          Historial
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

      {vista === "ventas" && modoVista === "pasos" && (
        <>
          {/* Barra de indicadores — chips horizontales en una sola línea */}
          {seccionesAbiertas.size === 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
                <span className="text-xs font-medium text-zinc-500">Hoy</span>
                <span className="text-sm font-bold text-zinc-900">{ventaHoy != null ? `$${ventaHoy.toFixed(2)}` : "—"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
                <span className="text-xs font-medium text-zinc-500">BCV</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  className="w-20 bg-transparent text-sm font-bold text-zinc-900 outline-none"
                  value={tasaDelDia}
                  onChange={(e) => setTasaDelDia(e.target.value)}
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={handleConsultarTasaBcv}
                  disabled={consultandoTasa}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
                >
                  {consultandoTasa ? "..." : "↻"}
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5">
                <span className="text-xs font-medium text-zinc-500">CxC</span>
                <span className="text-sm font-bold text-zinc-900">{cxcPendiente != null ? `$${cxcPendiente.toFixed(2)}` : "—"}</span>
              </div>
            </div>
          )}

          {/* Banner modo edición */}
          {editingId && (
            <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
              <span className="text-sm font-medium text-amber-800">✏️ Editando venta #{editingId}</span>
              <button type="button" onClick={cancelEdit} className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">
                Cancelar
              </button>
            </div>
          )}

          {/* Botones globales — arriba */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={expandirTodo} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100">
                Expandir todo
              </button>
              <button type="button" onClick={colapsarTodo} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100">
                Colapsar todo
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {/* PASO 1 — Productos del Pedido */}
            <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSeccion("paso1")}
                className="flex w-full items-center justify-between px-4 py-3 text-left min-h-[48px] hover:bg-zinc-50"
              >
                <span className="font-semibold text-sm text-zinc-800 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white text-xs font-bold">1</span>
                  Productos del Pedido
                  {!seccionesAbiertas.has("paso1") && items.some(i => i.productoId) && (
                    <span className="text-xs font-normal text-zinc-500 ml-1">
                      · {items.filter(i => i.productoId).length} producto(s) · ${totales.ventaTotalUsd.toFixed(2)}
                    </span>
                  )}
                </span>
                <span className="text-zinc-400 text-sm">{seccionesAbiertas.has("paso1") ? "▲" : "▼"}</span>
              </button>
              {seccionesAbiertas.has("paso1") && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-zinc-100">
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">Productos</span>
                      <button type="button" onClick={addItem} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100">+ Agregar producto</button>
                    </div>
                    <datalist id="productos-list-pasos">
                      {productos.map((p) => <option key={p.id} value={p.nombre} />)}
                    </datalist>
                    <div className="flex flex-col gap-2">
                      {items.map((item, index) => {
                        const producto = productosById.get(Number(item.productoId));
                        const cantidad = Number(item.cantidad) || 0;
                        const extra = producto?.extras.find((ex) => String(ex.id) === item.extraId);
                        const precioUnit = producto ? producto.precioVenta + (extra?.precioAdicional ?? 0) : 0;
                        return (
                          <div key={index} className="flex flex-col gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-zinc-500">Producto {index + 1}</span>
                              <button type="button" onClick={() => removeItem(index)} className="rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-sm font-medium text-zinc-700">Producto</label>
                              <input
                                list="productos-list-pasos"
                                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                value={item.productoNombre}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const match = productos.find((p) => p.nombre === value);
                                  updateItem(index, {
                                    productoNombre: value,
                                    productoId: match ? String(match.id) : "",
                                    extraId: "",
                                    variadaSelecciones: match?.tipoProducto === "VARIADA" ? Array.from({ length: match.variadaRaciones }, () => "") : [],
                                  });
                                }}
                                placeholder="Buscar producto..."
                              />
                            </div>
                            {producto && producto.extras.length > 0 && (
                              <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-zinc-700">Extra</label>
                                <select
                                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                  value={item.extraId}
                                  onChange={(e) => updateItem(index, { extraId: e.target.value })}
                                >
                                  <option value="">Sin extra</option>
                                  {producto.extras.map((ex) => <option key={ex.id} value={ex.id}>{ex.nombre} (+{ex.precioAdicional.toFixed(2)})</option>)}
                                </select>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col gap-1 flex-1">
                                <label className="text-sm font-medium text-zinc-700">Cantidad</label>
                                <input
                                  type="number" step="1" min="0"
                                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                                  value={item.cantidad}
                                  onChange={(e) => updateItem(index, { cantidad: ajustarCantidadConFlechas(item.cantidad, e.target.value) })}
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex flex-col gap-1 flex-1">
                                <label className="text-sm font-medium text-zinc-700">Subtotal</label>
                                <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 font-medium">${producto ? (precioUnit * cantidad).toFixed(2) : "0.00"}</div>
                              </div>
                            </div>
                            {producto?.tipoProducto === "VARIADA" && (
                              <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white p-2">
                                <span className="text-xs font-medium text-zinc-600">Raciones:</span>
                                {item.variadaSelecciones.map((seleccion, racionIndex) => (
                                  <select key={racionIndex} className="rounded-md border border-zinc-300 px-2 py-1 text-sm" value={seleccion}
                                    onChange={(e) => { const s = [...item.variadaSelecciones]; s[racionIndex] = e.target.value; updateItem(index, { variadaSelecciones: s }); }}>
                                    <option value="">Ración {racionIndex + 1}</option>
                                    {productos.filter((p) => p.tipoProducto === "NORMAL").map((p) => <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stockActual})</option>)}
                                  </select>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {puedeDescuento && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-zinc-700 whitespace-nowrap">% de descuento</label>
                      <input type="number" step="0.01" min="0" max="100" className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm" value={descuentoPorcentaje} onChange={(e) => setDescuentoPorcentaje(e.target.value)} placeholder="0" />
                      {totales.descuento > 0 && <span className="text-xs text-green-700 font-medium">−{totales.descuento.toFixed(2)}% (−${(totales.ventaTotalUsd - totales.ventaTotalConDescuentoUsd).toFixed(2)})</span>}
                    </div>
                  )}
                  <div className="text-sm font-medium text-zinc-700 text-right">
                    Subtotal: <span className="font-bold">${totales.ventaTotalConDescuentoUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => abrirSiguiente("paso1")} className="flex items-center gap-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                      Siguiente <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PASO 2 — Formas de pago */}
            <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSeccion("paso2")}
                className="flex w-full items-center justify-between px-4 py-3 text-left min-h-[48px] hover:bg-zinc-50"
              >
                <span className="font-semibold text-sm text-zinc-800 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white text-xs font-bold">2</span>
                  Formas de pago
                  {!seccionesAbiertas.has("paso2") && pagos.some(p => p.metodo) && (
                    <span className="text-xs font-normal text-zinc-500 ml-1">
                      · {pagos.filter(p => p.metodo).map(p => p.metodo).join(" + ")}
                    </span>
                  )}
                </span>
                <span className="text-zinc-400 text-sm">{seccionesAbiertas.has("paso2") ? "▲" : "▼"}</span>
              </button>
              {seccionesAbiertas.has("paso2") && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-zinc-100">
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">Forma de pago</span>
                      <button type="button" onClick={addPago} className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100">+ Agregar pago</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {pagos.map((pago, index) => (
                        <div key={index} className="flex flex-col gap-2">
                          <div className="grid grid-cols-12 items-center gap-2">
                            <select
                              className="col-span-7 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-8"
                              value={pago.metodo}
                              onChange={(e) => updatePago(index, { metodo: e.target.value as MetodoPago | "", montoAuto: true })}
                            >
                              <option value="">Selecciona forma de pago</option>
                              {METODOS_PAGO.map((m) => <option key={m} value={m}>{METODO_PAGO_LABELS[m]}</option>)}
                            </select>
                            <input
                              type="number" step="0.01" min="0"
                              readOnly={pago.metodo === "CASHEA"}
                              className={`col-span-4 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3 ${pago.metodo === "CASHEA" ? "bg-zinc-50 text-zinc-500" : ""}`}
                              value={pago.metodo === "CASHEA" ? (() => { const pct = Number(casheaPorcentaje) || 50; const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd; return (total * pct / 100).toFixed(2); })() : pago.montoAuto ? (pago.metodo ? totales.montoSugerido(index).toFixed(2) : "") : pago.monto}
                              onChange={(e) => { if (pago.metodo !== "CASHEA") updatePago(index, { monto: e.target.value, montoAuto: false }); }}
                              placeholder="Monto"
                            />
                            <button type="button" onClick={() => removePago(index)} className="col-span-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">X</button>
                          </div>
                          {pago.metodo === "CASHEA" && (
                            <div className="ml-0 rounded-lg border border-yellow-300 bg-yellow-50 p-3 flex flex-col gap-2">
                              <div className="flex flex-wrap gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-zinc-600">% Cuota inicial</label>
                                  <select value={casheaPorcentaje} onChange={(e) => setCasheaPorcentaje(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1 text-sm w-24">
                                    {casheaPorcentajes.map((p) => <option key={p} value={p}>{p}%</option>)}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-zinc-600">Días</label>
                                  <select value={casheaDiasSeleccion} onChange={(e) => setCasheaDiasSeleccion(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1 text-sm w-24">
                                    {casheaDiasOpciones.map((d) => <option key={d} value={d}>{d} días</option>)}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-zinc-600">Forma de pago de la inicial</label>
                                  <select value={casheaMetodoInicial} onChange={(e) => setCasheaMetodoInicial(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1 text-sm">
                                    <option value="">Seleccionar</option>
                                    {METODOS_PAGO.filter((m) => m !== "CASHEA").map((m) => <option key={m} value={m}>{METODO_PAGO_LABELS[m]}</option>)}
                                  </select>
                                </div>
                              </div>
                              {(() => {
                                const pct = Number(casheaPorcentaje) || 50;
                                const dias = Number(casheaDiasSeleccion) || 15;
                                const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                                const inicial = total * pct / 100;
                                const financiado = total - inicial;
                                const vence = addDays(fecha, dias);
                                return (
                                  <div className="flex flex-wrap gap-3 text-xs text-zinc-700">
                                    <span>Inicial: <strong>${inicial.toFixed(2)}</strong>{casheaMetodoInicial && <span className="ml-1 text-zinc-500">({METODO_PAGO_LABELS[casheaMetodoInicial as keyof typeof METODO_PAGO_LABELS]})</span>}</span>
                                    <span>Financiado: <strong className="text-yellow-700">${financiado.toFixed(2)}</strong></span>
                                    <span>Vence: <strong>{vence}</strong></span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {pagos.every((p) => !p.metodo) && (
                    <div className={`rounded-md border p-3 ${errorPlazoPago ? "border-red-300 bg-red-50" : "border-blue-300 bg-blue-200"}`}>
                      <button type="button" onClick={() => setMostrarCuentaPorCobrar((prev) => !prev)} className={`flex w-full items-center justify-between text-left text-sm font-semibold ${errorPlazoPago ? "text-red-800" : "text-blue-900"}`}>
                        <span>Cuenta por cobrar: indica el plazo de pago</span>
                        <span className="text-xs">{mostrarCuentaPorCobrar ? "▲" : "▼"}</span>
                      </button>
                      {errorPlazoPago && <p className="mt-1 text-xs font-medium text-red-700">Registre el Plazo de pago</p>}
                      {mostrarCuentaPorCobrar && (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-600">Días de crédito</label>
                            <input type="number" min="0" className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm" value={diasCredito} onChange={(e) => { const value = e.target.value; setDiasCredito(value); const dias = Number(value); if (value && !Number.isNaN(dias) && fecha) setFechaLimitePago(addDays(fecha, dias)); setErrorPlazoPago(false); }} placeholder="Ej: 15" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-zinc-600">Fecha límite</label>
                            <input type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fechaLimitePago} onChange={(e) => { setFechaLimitePago(e.target.value); setDiasCredito(""); setErrorPlazoPago(false); }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {(() => {
                    const tieneCashea = pagos.some((p) => p.metodo === "CASHEA");
                    const totalBase = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                    const pct = Number(casheaPorcentaje) || 50;
                    const casheaInicialUsd = tieneCashea ? totalBase * pct / 100 : 0;
                    const casheaFinanciadoUsd = tieneCashea ? totalBase - casheaInicialUsd : 0;
                    const tasa = Number(tasaDelDia) || 1;
                    const pagadoUsd = tieneCashea ? casheaInicialUsd : totales.totalPagosEnUsd;
                    const pagadoBs = pagadoUsd * tasa;
                    return (
                      <div className="grid grid-cols-1 gap-1 rounded-md bg-zinc-50 p-3 text-sm sm:grid-cols-2">
                        <div><span className="font-medium text-zinc-600">Total venta: </span>{totales.ventaTotalBs.toFixed(2)} Bs <span className="text-zinc-500">(${totales.ventaTotalUsd.toFixed(2)})</span></div>
                        {totales.descuento > 0 && <div><span className="font-medium text-green-700">Con descuento: </span>{totales.ventaTotalConDescuentoBs.toFixed(2)} Bs <span className="text-zinc-500">(${totales.ventaTotalConDescuentoUsd.toFixed(2)})</span></div>}
                        {modoEntrega === "DELIVERY" && <div><span className="font-medium text-zinc-600">Delivery: </span>{totales.costoDeliveryBs.toFixed(2)} Bs <span className="text-zinc-500">(${totales.costoDeliveryUsd.toFixed(2)})</span></div>}
                        <div><span className="font-medium text-zinc-600">Total a pagar: </span>{totales.totalAPagarBs.toFixed(2)} Bs <span className="text-zinc-500">(${totales.totalAPagarUsd.toFixed(2)})</span></div>
                        <div><span className="font-medium text-zinc-600">Total pagado: </span>{pagadoBs.toFixed(2)} Bs <span className="text-zinc-500">(${pagadoUsd.toFixed(2)})</span></div>
                        {tieneCashea && <div className="sm:col-span-2"><span className="font-medium text-yellow-700">CxC Cashea: </span><span className="font-semibold text-yellow-800">{(casheaFinanciadoUsd * tasa).toFixed(2)} Bs</span> <span className="text-zinc-500">(${casheaFinanciadoUsd.toFixed(2)})</span></div>}
                      </div>
                    );
                  })()}
                  <div className="flex justify-end">
                    <button type="button" onClick={() => abrirSiguiente("paso2")} className="flex items-center gap-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                      Siguiente <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PASO 3 — Parámetros de entrega */}
            <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSeccion("paso3")}
                className="flex w-full items-center justify-between px-4 py-3 text-left min-h-[48px] hover:bg-zinc-50"
              >
                <span className="font-semibold text-sm text-zinc-800 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white text-xs font-bold">3</span>
                  Parámetros de entrega
                  {!seccionesAbiertas.has("paso3") && (
                    <span className="text-xs font-normal text-zinc-500 ml-1">
                      · {modoEntrega === "DELIVERY" ? `Delivery · ${TIPO_DELIVERY_LABELS[tipoDelivery]}` : "Local"}
                    </span>
                  )}
                </span>
                <span className="text-zinc-400 text-sm">{seccionesAbiertas.has("paso3") ? "▲" : "▼"}</span>
              </button>
              {seccionesAbiertas.has("paso3") && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-zinc-100 mt-0 pt-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-zinc-700">Modo de entrega</label>
                      <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={modoEntrega} onChange={(e) => setModoEntrega(e.target.value as ModoEntrega)}>
                        {MODOS_ENTREGA.map((m) => <option key={m} value={m}>{m === "DELIVERY" ? "Delivery" : "Local"}</option>)}
                      </select>
                    </div>
                    {modoEntrega === "DELIVERY" && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-zinc-700">Tipo de delivery</label>
                        <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={tipoDelivery}
                          onChange={(e) => { const tipo = e.target.value as TipoDelivery; setTipoDelivery(tipo); if (tipo === "WINK") setCostoDelivery(winkCostoDefault); else if (tipo === "YUMMY") setCostoDelivery("0"); }}>
                          {TIPOS_DELIVERY.map((t) => <option key={t} value={t}>{TIPO_DELIVERY_LABELS[t]}</option>)}
                        </select>
                      </div>
                    )}
                    {modoEntrega === "DELIVERY" && tipoDelivery === "EMPRESA" && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-zinc-700">Motorizado</label>
                        <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={motorizadoId} onChange={(e) => setMotorizadoId(e.target.value)}>
                          <option value="">Sin asignar</option>
                          {motorizados.map((m) => <option key={m.id} value={m.id}>{m.apellido ? `${m.nombre} ${m.apellido}` : m.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    {modoEntrega === "DELIVERY" && (
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-zinc-700">Costo delivery</label>
                        <input type="number" step="0.01" min="0" className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400" value={costoDelivery} onChange={(e) => setCostoDelivery(e.target.value)} disabled={tipoDelivery === "YUMMY"} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-zinc-700">¿Despacho pendiente?</label>
                    <div className="flex gap-2">
                      {[true, false].map((val) => (
                        <button key={String(val)} type="button" onClick={() => setDespachoPendiente(val)}
                          className={`rounded-md border px-3 py-1.5 text-sm font-medium ${despachoPendiente === val ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 hover:bg-zinc-100"}`}>
                          {val ? "Sí" : "No"}
                        </button>
                      ))}
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
                        <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={minutosPrep} onChange={(e) => setMinutosPrep(e.target.value)}>
                          <option value="5">5 min antes</option>
                          <option value="15">15 min antes</option>
                          <option value="30">30 min antes</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      {minutosPrep === "otro" && (
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-zinc-700">Minutos antes</label>
                          <input type="number" min="1" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={minutosPrepCustom} onChange={(e) => setMinutosPrepCustom(e.target.value)} placeholder="Ej: 20" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-zinc-700">Avisar retiro</label>
                        <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={minutosRetiro} onChange={(e) => setMinutosRetiro(e.target.value)}>
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
                          <input type="number" min="1" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={minutosRetiroCustom} onChange={(e) => setMinutosRetiroCustom(e.target.value)} placeholder="Ej: 10" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-zinc-700">Delivery asignado</label>
                        <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={motorizadoId} onChange={(e) => setMotorizadoId(e.target.value)}>
                          <option value="">Sin asignar</option>
                          {motorizados.map((m) => <option key={m.id} value={m.id}>{m.apellido ? `${m.nombre} ${m.apellido}` : m.nombre}</option>)}
                        </select>
                      </div>
                      {horaPreparacionDate && <div className="flex flex-col justify-end text-sm text-zinc-600 sm:col-span-4">Alarma preparación: <span className="font-medium">{pad(horaPreparacionDate.getHours())}:{pad(horaPreparacionDate.getMinutes())}</span></div>}
                      {horaRetiroDate && <div className="flex flex-col justify-end text-sm text-zinc-600 sm:col-span-4">Alarma retiro: <span className="font-medium">{pad(horaRetiroDate.getHours())}:{pad(horaRetiroDate.getMinutes())}</span></div>}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button type="button" onClick={() => abrirSiguiente("paso3")} className="flex items-center gap-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                      Siguiente <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PASO 4 — Datos del Cliente */}
            <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSeccion("paso4")}
                className="flex w-full items-center justify-between px-4 py-3 text-left min-h-[48px] hover:bg-zinc-50"
              >
                <span className="font-semibold text-sm text-zinc-800 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white text-xs font-bold">4</span>
                  Datos del Cliente
                  {!seccionesAbiertas.has("paso4") && cliente && (
                    <span className="text-xs font-normal text-zinc-500 ml-1">· {cliente}</span>
                  )}
                </span>
                <span className="text-zinc-400 text-sm">{seccionesAbiertas.has("paso4") ? "▲" : "▼"}</span>
              </button>
              {seccionesAbiertas.has("paso4") && (
                <div className="px-4 pb-4 border-t border-zinc-100 mt-0">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-zinc-700">Fecha</label>
                      <input type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-zinc-700">Tasa del día</label>
                      <div className="flex gap-1">
                        <input type="number" step="0.0001" min="0" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={tasaDelDia} onChange={(e) => setTasaDelDia(e.target.value)} placeholder="0.00" />
                        <button type="button" onClick={handleConsultarTasaBcv} disabled={consultandoTasa} className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50">{consultandoTasa ? "..." : "BCV"}</button>
                      </div>
                      {tasaBcvFecha && <span className="text-xs text-zinc-500">BCV: {formatFecha(tasaBcvFecha)}</span>}
                      {tasaBcvError && <span className="text-xs text-red-600">{tasaBcvError}</span>}
                    </div>
                    <div className="relative flex flex-col gap-1 sm:col-span-2">
                      <label className="text-sm font-medium text-zinc-700">Cliente</label>
                      <div className="flex gap-1">
                        <input className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={cliente} onChange={(e) => setCliente(e.target.value)} onFocus={() => clientesResultados.length > 0 && setMostrarResultados(true)} placeholder="Nombre del cliente" required />
                        <button type="button" onClick={() => buscarClientes(cliente || clienteCi)} disabled={buscandoClientes} className="shrink-0 rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50">{buscandoClientes ? "..." : "Buscar"}</button>
                      </div>
                      {puedeMostrarResultados && clientesResultados.length > 0 && (
                        <ul className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                          {clientesResultados.map((c) => (
                            <li key={c.id}>
                              <button type="button" onClick={() => seleccionarCliente(c)} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-100">
                                <span className="font-medium">{c.nombre}</span>
                                <span className="text-xs text-zinc-500">{c.cedula ?? "Sin C.I/Rif"}{c.telefono ? ` · ${c.telefono}` : ""}{c.direccion ? ` · ${c.direccion}` : ""}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-zinc-700">C.I/Rif{clientesConfig.cedulaObligatoria && " *"}</label>
                      <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={clienteCi} onChange={(e) => setClienteCi(e.target.value)} placeholder="Ej: V12345678" required={clientesConfig.cedulaObligatoria} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-zinc-700">Teléfono{clientesConfig.telefonoObligatorio && " *"}</label>
                      <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} placeholder="Ej: 584129002211" required={clientesConfig.telefonoObligatorio} />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-sm font-medium text-zinc-700">Dirección{clientesConfig.direccionObligatoria && " *"}</label>
                      <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder={clientesConfig.direccionObligatoria ? "" : "Opcional"} required={clientesConfig.direccionObligatoria} />
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <label className="text-sm font-medium text-zinc-700">Observaciones</label>
                      <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Botones globales — abajo */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex gap-2">
                <button type="button" onClick={expandirTodo} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100">Expandir todo</button>
                <button type="button" onClick={colapsarTodo} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100">Colapsar todo</button>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                  {editingId ? "Guardar cambios" : "Registrar venta"}
                </button>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100">Cancelar</button>
                )}
              </div>
            </div>
          </form>
        </>
      )}

      {vista === "ventas" && modoVista === "clasico" && (
    <>
      {editingId && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <span className="text-sm font-medium text-amber-800">✏️ Editando venta #{editingId}</span>
          <button type="button" onClick={cancelEdit} className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">
            Cancelar
          </button>
        </div>
      )}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            {modoEntrega === "DELIVERY" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Tipo de delivery</label>
                <select
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={tipoDelivery}
                  onChange={(e) => {
                    const tipo = e.target.value as TipoDelivery;
                    setTipoDelivery(tipo);
                    if (tipo === "WINK") setCostoDelivery(winkCostoDefault);
                    else if (tipo === "YUMMY") setCostoDelivery("0");
                  }}
                >
                  {TIPOS_DELIVERY.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_DELIVERY_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {modoEntrega === "DELIVERY" && tipoDelivery === "EMPRESA" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Motorizado</label>
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
            )}
            {modoEntrega === "DELIVERY" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Costo delivery</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                  value={costoDelivery}
                  onChange={(e) => setCostoDelivery(e.target.value)}
                  disabled={tipoDelivery === "YUMMY"}
                />
              </div>
            )}
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

        {puedeDescuento && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-zinc-700 whitespace-nowrap">% de descuento</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={descuentoPorcentaje}
              onChange={(e) => setDescuentoPorcentaje(e.target.value)}
              placeholder="0"
            />
            {totales.descuento > 0 && (
              <span className="text-xs text-green-700 font-medium">
                Descuento: −{totales.descuento.toFixed(2)}% (−${(totales.ventaTotalUsd - totales.ventaTotalConDescuentoUsd).toFixed(2)})
              </span>
            )}
          </div>
        )}

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
              <div key={index} className="flex flex-col gap-2">
                <div className="grid grid-cols-12 items-center gap-2">
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
                    readOnly={pago.metodo === "CASHEA"}
                    className={`col-span-4 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3 ${pago.metodo === "CASHEA" ? "bg-zinc-50 text-zinc-500" : ""}`}
                    value={
                      pago.metodo === "CASHEA"
                        ? (() => {
                            const pct = Number(casheaPorcentaje) || 50;
                            const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                            return (total * pct / 100).toFixed(2);
                          })()
                        : pago.montoAuto
                          ? pago.metodo
                            ? totales.montoSugerido(index).toFixed(2)
                            : ""
                          : pago.monto
                    }
                    onChange={(e) => {
                      if (pago.metodo !== "CASHEA") updatePago(index, { monto: e.target.value, montoAuto: false });
                    }}
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
                {pago.metodo === "CASHEA" && (
                  <div className="ml-0 rounded-lg border border-yellow-300 bg-yellow-50 p-3 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-zinc-600">% Cuota inicial</label>
                        <select
                          value={casheaPorcentaje}
                          onChange={(e) => setCasheaPorcentaje(e.target.value)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm w-24"
                        >
                          {casheaPorcentajes.map((p) => (
                            <option key={p} value={p}>{p}%</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-zinc-600">Días</label>
                        <select
                          value={casheaDiasSeleccion}
                          onChange={(e) => setCasheaDiasSeleccion(e.target.value)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm w-24"
                        >
                          {casheaDiasOpciones.map((d) => (
                            <option key={d} value={d}>{d} días</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-zinc-600">Forma de pago de la inicial</label>
                        <select
                          value={casheaMetodoInicial}
                          onChange={(e) => setCasheaMetodoInicial(e.target.value)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                        >
                          <option value="">Seleccionar</option>
                          {METODOS_PAGO.filter((m) => m !== "CASHEA").map((m) => (
                            <option key={m} value={m}>{METODO_PAGO_LABELS[m]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {(() => {
                      const pct = Number(casheaPorcentaje) || 50;
                      const dias = Number(casheaDiasSeleccion) || 15;
                      const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                      const inicial = total * pct / 100;
                      const financiado = total - inicial;
                      const vence = addDays(fecha, dias);
                      return (
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-700">
                          <span>Inicial cobrado: <strong>${inicial.toFixed(2)}</strong>{casheaMetodoInicial && <span className="ml-1 text-zinc-500">({METODO_PAGO_LABELS[casheaMetodoInicial as keyof typeof METODO_PAGO_LABELS]})</span>}</span>
                          <span>Financiado por Cashea: <strong className="text-yellow-700">${financiado.toFixed(2)}</strong></span>
                          <span>Vence: <strong>{vence}</strong></span>
                        </div>
                      );
                    })()}
                  </div>
                )}
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

        {(() => {
          const tieneCashea = pagos.some((p) => p.metodo === "CASHEA");
          const totalBase = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
          const pct = Number(casheaPorcentaje) || 50;
          const casheaInicialUsd = tieneCashea ? totalBase * pct / 100 : 0;
          const casheaFinanciadoUsd = tieneCashea ? totalBase - casheaInicialUsd : 0;
          const tasa = Number(tasaDelDia) || 1;
          const pagadoUsd = tieneCashea ? casheaInicialUsd : totales.totalPagosEnUsd;
          const pagadoBs = pagadoUsd * tasa;
          return (
            <div className="grid grid-cols-1 gap-2 rounded-md bg-white p-3 text-sm sm:grid-cols-2">
              <div>
                <span className="font-medium text-zinc-600">Total venta: </span>
                {totales.ventaTotalBs.toFixed(2)} Bs{" "}
                <span className="text-zinc-500">(${totales.ventaTotalUsd.toFixed(2)})</span>
              </div>
              {totales.descuento > 0 && (
                <div>
                  <span className="font-medium text-green-700">Con descuento ({totales.descuento}%): </span>
                  {totales.ventaTotalConDescuentoBs.toFixed(2)} Bs{" "}
                  <span className="text-zinc-500">(${totales.ventaTotalConDescuentoUsd.toFixed(2)})</span>
                </div>
              )}
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
                {pagadoBs.toFixed(2)} Bs{" "}
                <span className="text-zinc-500">(${pagadoUsd.toFixed(2)})</span>
              </div>
              {tieneCashea && (
                <div className="sm:col-span-2">
                  <span className="font-medium text-yellow-700">CxC Cashea: </span>
                  <span className="font-semibold text-yellow-800">{(casheaFinanciadoUsd * tasa).toFixed(2)} Bs</span>{" "}
                  <span className="text-zinc-500">(${casheaFinanciadoUsd.toFixed(2)})</span>
                </div>
              )}
            </div>
          );
        })()}
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
    </>
      )}

      {vista === "historial" && (
      <div className="flex flex-col gap-4">
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
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={soloPendientesPago}
            onChange={(e) => setSoloPendientesPago(e.target.checked)}
          />
          Solo pendientes por pagar
        </label>
      </div>

      {!soloPendientesPago && (
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={handleFiltroHoy}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleFiltroAyer}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Ayer
          </button>
          <button
            type="button"
            onClick={handleFiltroSemana}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={handleFiltroMes}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
          >
            Este mes
          </button>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">Desde</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600">Hasta</label>
            <input
              type="date"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
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
            {ventasFiltradas
              .slice((paginaVentas - 1) * porPaginaVentas, paginaVentas * porPaginaVentas)
              .map((venta) => {
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
                        onClick={() => { startEdit(venta); setVista("ventas"); }}
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
        <Paginador
          total={ventasFiltradas.length}
          pagina={paginaVentas}
          porPagina={porPaginaVentas}
          opcionesPorPagina={[15, 25, 50, 100]}
          onPagina={setPaginaVentas}
          onPorPagina={setPorPaginaVentas}
        />
      </div>
      </div>
      )}
    </div>
  );
}

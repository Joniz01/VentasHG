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
  type EmpaqueProducto,
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
import { YummyIcon, YummyToggle } from "@/components/YummyIcon";
import FechaPagoConfirm from "@/components/FechaPagoConfirm";

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

const METODO_PAGO_ICONS: Record<string, string> = {
  PUNTO_VENTA: "💳",
  TRANSFERENCIA: "🏦",
  PAGO_MOVIL: "📱",
  EFECTIVO_BS: "🪙",
  EFECTIVO_USD: "💵",
  ZELLE: "__zelle__",
  CASHEA: "🟡",
  YUMMY: "__yummy__",
};

function ZelleIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#6D1ED4"/>
      <path d="M10 12h14.5L10 26.5V30h20v-4H15.5L30 11.5V8H10v4z" fill="white"/>
    </svg>
  );
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

function toTitleCase(s: string): string {
  return s.trim().replace(/\s+/g, " ").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function autoSplitNombre(fullName: string): { nombre: string; apellido: string; flagged: boolean } {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length <= 1) return { nombre: toTitleCase(fullName), apellido: "", flagged: false };
  if (parts.length === 2) return { nombre: toTitleCase(parts[0]), apellido: toTitleCase(parts[1]), flagged: false };
  return { nombre: toTitleCase(parts[0]), apellido: toTitleCase(parts.slice(1).join(" ")), flagged: true };
}

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
  const [vista, setVista] = useState<"ventas" | "cortesias" | "historial" | "notas">("ventas");
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [porPaginaVentas, setPorPaginaVentas] = useState(25);
  const [clientesConfig, setClientesConfig] = useState<ClientesConfig>(CLIENTES_CONFIG_DEFAULT);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [modalEmpaque, setModalEmpaque] = useState<{
    itemIndex: number;
    producto: Producto;
    empaques: EmpaqueProducto[];
    seleccionado: number | null;
    abriendo: boolean;
    error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Salida Cortesías ──
  type SalidaHistRow = {
    id: number; tipo: string; fecha: string; beneficiario: string | null;
    motivo: string | null; responsable: string | null; anulada: boolean;
    items: { nombre: string; cantidad: number }[];
  };
  const [cortTipo, setCortTipo] = useState<"CORTESIA" | "SORTEO" | "MUESTRA" | "EVENTO" | "FIDELIDAD">("CORTESIA");
  const [cortFecha, setCortFecha] = useState(today());
  const [cortBeneficiario, setCortBeneficiario] = useState("");
  const [cortBenefNombre, setCortBenefNombre] = useState("");
  const [cortBenefApellido, setCortBenefApellido] = useState("");
  const [cortBenefSplitWarning, setCortBenefSplitWarning] = useState(false);
  const [cortBenefResultados, setCortBenefResultados] = useState<Cliente[]>([]);
  const [cortBenefMostrar, setCortBenefMostrar] = useState(false);
  const [cortBenefBuscando, setCortBenefBuscando] = useState(false);
  const [cortBenefNuevoPanel, setCortBenefNuevoPanel] = useState(false);
  const [cortBenefNuevoCi, setCortBenefNuevoCi] = useState("");
  const [cortBenefNuevoTel, setCortBenefNuevoTel] = useState("");
  const [cortBenefNuevoDir, setCortBenefNuevoDir] = useState("");
  const [cortBenefGuardando, setCortBenefGuardando] = useState(false);
  const [cortMotivo, setCortMotivo] = useState("");
  const [cortItems, setCortItems] = useState<{ productoId: string; cantidad: string }[]>([{ productoId: "", cantidad: "1" }]);
  const [cortSaving, setCortSaving] = useState(false);
  const [cortError, setCortError] = useState<string | null>(null);
  const [cortSuccess, setCortSuccess] = useState(false);
  const [cortHistorial, setCortHistorial] = useState<SalidaHistRow[]>([]);
  const [cortHistLoading, setCortHistLoading] = useState(false);
  const [cortPorPagina, setCortPorPagina] = useState(10);
  const [cortPagina, setCortPagina] = useState(1);
  const [cortAnulando, setCortAnulando] = useState<number | null>(null);
  const [cortEditingId, setCortEditingId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [fecha, setFecha] = useState(today());
  const [tasaDelDia, setTasaDelDia] = useState("");
  const [cliente, setCliente] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteApellido, setClienteApellido] = useState("");
  const [clienteSplitWarning, setClienteSplitWarning] = useState(false);
  const [clienteNuevoPanel, setClienteNuevoPanel] = useState(false);
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
  const [yummyDiasOpciones, setYummyDiasOpciones] = useState<string[]>(["2"]);
  const [yummyDiasSeleccion, setYummyDiasSeleccion] = useState("2");
  const [observaciones, setObservaciones] = useState("");
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [pagos, setPagos] = useState<PagoRow[]>([{ ...EMPTY_PAGO }]);
  const [diasCredito, setDiasCredito] = useState("");
  const [fechaLimitePago, setFechaLimitePago] = useState("");
  const [mostrarCuentaPorCobrar, setMostrarCuentaPorCobrar] = useState(false);
  const [errorPlazoPago, setErrorPlazoPago] = useState(false);
  const [despachoPendiente, setDespachoPendiente] = useState(true); // DELIVERY is default modoEntrega
  const [fechaEntrega, setFechaEntrega] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }));
  const [horaEntrega, setHoraEntrega] = useState("");
  const [minutosPrep, setMinutosPrep] = useState("15");
  const [minutosPrepCustom, setMinutosPrepCustom] = useState("");
  const [minutosRetiro, setMinutosRetiro] = useState("10");
  const [minutosRetiroCustom, setMinutosRetiroCustom] = useState("");
  const [motorizadoId, setMotorizadoId] = useState("");
  const [tasaBcvFecha, setTasaBcvFecha] = useState<string | null>(null);
  const [tasaBcvError, setTasaBcvError] = useState<string | null>(null);
  const [consultandoTasa, setConsultandoTasa] = useState(false);

  // Modo de vista y wizard
  const [modoVista, setModoVista] = useState<"clasico" | "pasos">("pasos");
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Set<string>>(new Set(["paso1", "paso2", "paso3", "paso4"]));
  // Orden de pasos: "default" = Productos→Pago→Entrega→Cliente | "entrega_primero" = Productos→Entrega→Pago→Cliente
  const [ordenPasos, setOrdenPasos] = useState<string>("entrega_primero");
  // Wizard step (1-4) — used in pasos mode
  const [pasoActual, setPasoActual] = useState(1);
  const [ventaHoy, setVentaHoy] = useState<number | null>(null);
  const [ingresos, setIngresos] = useState<number | null>(null);
  const [metaTotalHoy, setMetaTotalHoy] = useState<number>(1);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  function toggleSeccion(key: string) {
    setSeccionesAbiertas(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function handleModoEntrega(modo: ModoEntrega) {
    setModoEntrega(modo);
    if (modo === "DELIVERY" || modo === "PICK_UP") {
      setDespachoPendiente(true);
    } else {
      setDespachoPendiente(false);
    }
  }

  function abrirSiguiente(actual: string) {
    const orden = ordenPasos === "entrega_primero"
      ? ["paso1", "paso3", "paso2", "paso4"]
      : ordenPasos === "cliente_primero"
      ? ["paso4", "paso1", "paso3", "paso2"]
      : ["paso1", "paso2", "paso3", "paso4"];
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
  const [casheaConfirm, setCasheaConfirm] = useState<{ ventaId: number; tasa: string; fechaPago: string } | null>(null);
  const [yummyConfirmId, setYummyConfirmId] = useState<number | null>(null);
  const [casheaUpdating, setCasheaUpdating] = useState<number | null>(null);
  const [filtroFechaDesde, setFiltroFechaDesde] = useState(() => today());
  const [filtroFechaHasta, setFiltroFechaHasta] = useState(() => today());

  const hayDatosIngresados = useCallback(() => {
    if (editingId !== null) return false;
    return (
      clienteNombre.trim() !== "" ||
      clienteApellido.trim() !== "" ||
      clienteCi.trim() !== "" ||
      clienteTelefono.trim() !== "" ||
      observaciones.trim() !== "" ||
      items.some((i) => i.productoId !== "") ||
      pagos.some((p) => p.monto !== "")
    );
  }, [editingId, clienteNombre, clienteApellido, clienteCi, clienteTelefono, observaciones, items, pagos]);

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
        if (cfg.yummy_dias) {
          const opts = cfg.yummy_dias.split(",").map((s: string) => s.trim()).filter(Boolean);
          setYummyDiasOpciones(opts);
          const def = cfg.yummy_dias_default ?? opts[0] ?? "2";
          setYummyDiasSeleccion(def);
        }
        // Modo de vista y secciones — se aplica después de cargar preferencias de usuario
        fetch("/api/usuarios/perfil")
          .then((r) => r.json())
          .then((user: { ventas_modo_vista?: string | null; ventas_orden_pasos?: string | null }) => {
            const modo = user.ventas_modo_vista ?? cfg.ventas_modo_vista ?? "pasos";
            const orden = user.ventas_orden_pasos ?? cfg.ventas_orden_pasos ?? "default";
            if (modo === "pasos") {
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
            setOrdenPasos(orden);
          })
          .catch(() => {});
      })
      .catch(() => {});
    // Cargar indicadores de hoy, ingresos y CxC
    fetch("/api/resumen")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ventaHoy?.total_usd != null) setVentaHoy(Number(d.ventaHoy.total_usd));
        if (d?.ingresos?.total_usd != null) setIngresos(Number(d.ingresos.total_usd));
      })
      .catch(() => {});
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.ventas_meta_total_hoy != null) setMetaTotalHoy(Number(cfg.ventas_meta_total_hoy));
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
    const query = (clienteNombre.trim() + " " + clienteApellido.trim()).trim() || clienteCi.trim();
    if (query.length < 4) {
      return;
    }

    const timeout = setTimeout(() => {
      buscarClientes(query);
    }, 400);

    return () => clearTimeout(timeout);
  }, [clienteNombre, clienteApellido, clienteCi]);

  const puedeMostrarResultados =
    mostrarResultados && ((clienteNombre.trim() + clienteApellido.trim()).length >= 4 || clienteCi.trim().length >= 4);

  async function buscarCortBenef(query: string) {
    if (query.trim().length < 4) return;
    setCortBenefBuscando(true);
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(query.trim())}`);
      const data = (await res.json()) as Cliente[];
      setCortBenefResultados(data);
      setCortBenefMostrar(true);
    } catch {
      setCortBenefResultados([]);
    } finally {
      setCortBenefBuscando(false);
    }
  }

  function seleccionarCortBenef(c: Cliente) {
    if (c.apellido) {
      setCortBenefNombre(toTitleCase(c.nombre));
      setCortBenefApellido(toTitleCase(c.apellido));
      setCortBenefSplitWarning(false);
    } else {
      const split = autoSplitNombre(c.nombre);
      setCortBenefNombre(split.nombre);
      setCortBenefApellido(split.apellido);
      setCortBenefSplitWarning(split.flagged);
    }
    setCortBenefMostrar(false);
    setCortBenefNuevoPanel(false);
  }

  function seleccionarCliente(c: Cliente) {
    setCliente((c.nombre + " " + (c.apellido ?? "")).trim());
    if (c.apellido) {
      setClienteNombre(toTitleCase(c.nombre));
      setClienteApellido(toTitleCase(c.apellido));
      setClienteSplitWarning(false);
    } else {
      const split = autoSplitNombre(c.nombre);
      setClienteNombre(split.nombre);
      setClienteApellido(split.apellido);
      setClienteSplitWarning(split.flagged);
    }
    setClienteNuevoPanel(false);
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

  const horaEntregaDate = combinarFechaHora(fechaEntrega || fecha, horaEntrega);
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

  async function handleAbrirEmpaque() {
    if (!modalEmpaque || !modalEmpaque.seleccionado) return;
    setModalEmpaque((prev) => prev ? { ...prev, abriendo: true, error: null } : null);
    try {
      const res = await fetch("/api/inventario/abrir-empaque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidadId: modalEmpaque.producto.id, empaqueRelId: modalEmpaque.seleccionado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al abrir empaque");
      // Actualizar stocks localmente sin recargar toda la lista
      const empaqueRel = modalEmpaque.empaques.find(e => e.id === modalEmpaque.seleccionado);
      if (empaqueRel) {
        setProductos((prev) => prev.map((p) => {
          if (p.id === empaqueRel.empaqueId) return { ...p, stockActual: p.stockActual - 1 };
          if (p.id === modalEmpaque.producto.id) return { ...p, stockActual: p.stockActual + data.rendimiento };
          return p;
        }));
      }
      setModalEmpaque(null);
    } catch (err) {
      setModalEmpaque((prev) => prev ? { ...prev, abriendo: false, error: err instanceof Error ? err.message : "Error" } : null);
    }
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
    setClienteNombre("");
    setClienteApellido("");
    setClienteSplitWarning(false);
    setClienteNuevoPanel(false);
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
    setFechaEntrega(new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" }));
    setHoraEntrega("");
    setMinutosPrep("15");
    setMinutosPrepCustom("");
    setMinutosRetiro("10");
    setMinutosRetiroCustom("");
    setMotorizadoId("");
    setCasheaPorcentaje(casheaPorcentajes[0] ?? "50");
    setCasheaDiasSeleccion(casheaDiasOpciones[0] ?? "15");
    setYummyDiasSeleccion(yummyDiasOpciones[0] ?? "2");
    setPasoActual(1);
  }

  function startEdit(venta: Venta) {
    setEditingId(venta.id);
    setFecha(String(venta.fecha).slice(0, 10));
    setTasaDelDia(String(venta.tasaDelDia));
    setCliente(venta.cliente);
    { const split = autoSplitNombre(venta.cliente); setClienteNombre(split.nombre); setClienteApellido(split.apellido); setClienteSplitWarning(false); }
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

    const esDespacho = venta.modoEntrega === "DELIVERY" || venta.modoEntrega === "PICK_UP";
    if (esDespacho && venta.horaEntrega && venta.horaPreparacion) {
      const entregaDate = new Date(venta.horaEntrega);
      const prepDate = new Date(venta.horaPreparacion);
      setDespachoPendiente(true);
      setFechaEntrega(entregaDate.toLocaleDateString("en-CA", { timeZone: "America/Caracas" }));
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
      setDespachoPendiente(esDespacho);
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

    const clienteFullName = (clienteNombre.trim() + " " + clienteApellido.trim()).trim();
    if (!clienteFullName) {
      setError("El nombre del cliente es obligatorio");
      return;
    }
    setCliente(clienteFullName);

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
        cliente: clienteFullName,
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
        yummyDatos: validPagos.some((p) => p.metodo === "YUMMY")
          ? (() => {
              const dias = Number(yummyDiasSeleccion) || 2;
              const monto = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
              const fechaVenc = addDays(fecha, dias);
              return { monto, dias, fechaVencimiento: fechaVenc };
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

  async function handleLiquidarCashea(ventaId: number, fechaPago?: string) {
    setCasheaUpdating(ventaId);
    try {
      const res = await fetch(`/api/reportes/cashea/${ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidado: true, fechaPago }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al liquidar Cashea");
      setCasheaConfirm(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al liquidar Cashea");
    } finally {
      setCasheaUpdating(null);
    }
  }

  async function handleLiquidarYummy(ventaId: number, liquidado: boolean, fechaPago?: string) {
    setCasheaUpdating(ventaId);
    try {
      const res = await fetch(`/api/reportes/yummy/${ventaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liquidado, fechaPago }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al actualizar Yummy");
      setYummyConfirmId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar Yummy");
    } finally {
      setCasheaUpdating(null);
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

  function startCortEdit(s: SalidaHistRow) {
    setCortEditingId(s.id);
    setCortTipo(s.tipo as "CORTESIA" | "SORTEO" | "MUESTRA" | "EVENTO" | "FIDELIDAD");
    setCortFecha(s.fecha ? s.fecha.slice(0, 10) : today());
    setCortBeneficiario(s.beneficiario ?? "");
    setCortMotivo(s.motivo ?? "");
    setCortItems(s.items.map((it) => ({ productoId: String((it as { productoId?: number; nombre: string; cantidad: number }).productoId ?? ""), cantidad: String(it.cantidad) })));
    setCortError(null);
    setCortSuccess(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadCortHistorial() {
    setCortHistLoading(true);
    try {
      const res = await fetch("/api/salidas-gratuitas");
      if (res.ok) setCortHistorial(await res.json());
    } finally {
      setCortHistLoading(false);
    }
  }

  async function handleAnularSalida(id: number) {
    if (!confirm("¿Anular esta salida? El stock será restaurado.")) return;
    setCortAnulando(id);
    try {
      const res = await fetch(`/api/salidas-gratuitas/${id}/anular`, { method: "POST" });
      if (res.ok) {
        await loadCortHistorial();
      } else {
        const data = await res.json();
        alert(data.error ?? "Error al anular");
      }
    } finally {
      setCortAnulando(null);
    }
  }

  async function handleCortesiaSubmit(e: FormEvent) {
    e.preventDefault();
    setCortError(null);
    setCortSuccess(false);
    const items = cortItems.filter((i) => i.productoId && Number(i.cantidad) > 0);
    if (!items.length) { setCortError("Agrega al menos un producto con cantidad válida."); return; }
    setCortSaving(true);
    try {
      const url = cortEditingId ? `/api/salidas-gratuitas/${cortEditingId}` : "/api/salidas-gratuitas";
      const method = cortEditingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: cortTipo, fecha: cortFecha, beneficiario: (cortBenefNombre.trim() + " " + cortBenefApellido.trim()).trim() || cortBeneficiario, motivo: cortMotivo, items }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCortError(data.error ?? "Error al registrar la salida.");
      } else {
        setCortSuccess(true);
        setCortEditingId(null);
        setCortItems([{ productoId: "", cantidad: "1" }]);
        setCortBeneficiario("");
        setCortBenefNombre("");
        setCortBenefApellido("");
        setCortBenefSplitWarning(false);
        setCortBenefNuevoPanel(false);
        setCortBenefNuevoCi("");
        setCortBenefNuevoTel("");
        setCortBenefNuevoDir("");
        setCortMotivo("");
        setCortTipo("CORTESIA");
        setCortFecha(today());
        setCortPagina(1);
        await loadCortHistorial();
      }
    } catch {
      setCortError("Error de red. Intenta de nuevo.");
    } finally {
      setCortSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 min-w-0 w-full overflow-x-hidden">
      {/* ERP anchor tab bar */}
      <div
        className="print:hidden border-b overflow-x-auto"
        style={{ borderColor: "var(--erp-border)" }}
      >
      <div className="flex gap-0 min-w-max">
        {(["ventas", "cortesias", "historial", "notas"] as const).map((v) => {
          const labels: Record<string, string> = { ventas: "Registro de Ventas", cortesias: "Salida Cortesías", historial: "Historial", notas: "Notas de Entrega" };
          const active = vista === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => { setVista(v); if (v === "cortesias") loadCortHistorial(); }}
              className="px-4 py-2.5 text-[12.5px] font-medium transition-colors whitespace-nowrap"
              style={{
                color: active ? "var(--erp-primary)" : "var(--erp-text-2)",
                borderBottom: active ? "2px solid var(--erp-primary)" : "2px solid transparent",
                marginBottom: "-1px",
                background: "transparent",
              }}
            >
              {labels[v]}
            </button>
          );
        })}
      </div>
      </div>

      {vista === "notas" && <NotasEntregaTab productos={productos} />}

      {vista === "cortesias" && (
        <form onSubmit={handleCortesiaSubmit} className="flex flex-col gap-4">
          {/* Banner edición */}
          {cortEditingId && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FEF3C7", border: "1.5px solid #F59E0B", borderRadius: 8, padding: "10px 14px" }}>
              <span style={{ fontSize: 16 }}>✏️</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#92400E" }}>Editando salida #{cortEditingId} — los cambios actualizarán el stock automáticamente.</span>
              <button type="button" onClick={() => { setCortEditingId(null); setCortItems([{ productoId: "", cantidad: "1" }]); setCortBeneficiario(""); setCortMotivo(""); setCortTipo("CORTESIA"); setCortError(null); setCortSuccess(false); }} style={{ fontSize: 11, color: "#92400E", background: "transparent", border: "1px solid #F59E0B", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontWeight: 700 }}>Cancelar edición</button>
            </div>
          )}
          {/* Tipo */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)", marginBottom: 10 }}>Tipo de salida</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
              {(["CORTESIA", "SORTEO", "MUESTRA", "EVENTO", "FIDELIDAD"] as const).map((t) => {
                const icons: Record<string, string> = { CORTESIA: "🤝", SORTEO: "🎯", MUESTRA: "📋", EVENTO: "🎪", FIDELIDAD: "🎖️" };
                const labels: Record<string, string> = { CORTESIA: "Cortesía", SORTEO: "Sorteo", MUESTRA: "Muestra", EVENTO: "Evento", FIDELIDAD: "Fidelidad" };
                const sel = cortTipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCortTipo(t)}
                    style={{
                      padding: "7px 4px", border: `1.5px solid ${sel ? "var(--erp-primary)" : "var(--erp-border)"}`,
                      borderRadius: 8, textAlign: "center", cursor: "pointer", background: sel ? "var(--erp-primary-lt)" : "var(--erp-surface)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 17 }}>{icons[t]}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".03em", color: sel ? "var(--erp-primary)" : "var(--erp-text-2)", lineHeight: 1.2 }}>{labels[t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha y Beneficiario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--erp-text-3)" }}>Fecha</label>
              <input
                type="date"
                value={cortFecha}
                onChange={(e) => setCortFecha(e.target.value)}
                required
                style={{ padding: "8px 11px", border: "1.5px solid var(--erp-border)", borderRadius: 7, fontSize: 13, background: "var(--erp-surface)", color: "var(--erp-text)" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--erp-text-3)" }}>Beneficiario / Destinatario</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={cortBenefNombre}
                    onChange={(e) => { setCortBenefNombre(e.target.value); buscarCortBenef((e.target.value + " " + cortBenefApellido).trim()); }}
                    onBlur={(e) => setCortBenefNombre(toTitleCase(e.target.value))}
                    placeholder="Nombre"
                    style={{ width: "100%", padding: "8px 11px", border: "1.5px solid var(--erp-border)", borderRadius: 7, fontSize: 13, background: "var(--erp-surface)", color: "var(--erp-text)", boxSizing: "border-box" }}
                  />
                  {cortBenefMostrar && cortBenefResultados.length > 0 && (
                    <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 7, boxShadow: "0 4px 12px rgba(0,0,0,.12)", maxHeight: 180, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
                      {cortBenefResultados.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => seleccionarCortBenef(c)} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                            <span style={{ fontWeight: 600 }}>{c.nombre}{c.apellido ? " " + c.apellido : ""}</span>
                            <span style={{ fontSize: 11, color: "var(--erp-text-3)", display: "block" }}>{c.cedula ?? "Sin C.I"}{c.telefono ? " · " + c.telefono : ""}</span>
                          </button>
                        </li>
                      ))}
                      <li>
                        <button type="button" onClick={() => { setCortBenefMostrar(false); setCortBenefNuevoPanel(true); }} style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderTop: "1px solid var(--erp-border)", cursor: "pointer", fontSize: 12, color: "var(--erp-primary)", fontWeight: 600 }}>
                          + Registrar como nuevo cliente
                        </button>
                      </li>
                    </ul>
                  )}
                </div>
                <input
                  type="text"
                  value={cortBenefApellido}
                  onChange={(e) => setCortBenefApellido(e.target.value)}
                  onBlur={(e) => setCortBenefApellido(toTitleCase(e.target.value))}
                  placeholder="Apellido"
                  style={{ padding: "8px 11px", border: "1.5px solid var(--erp-border)", borderRadius: 7, fontSize: 13, background: "var(--erp-surface)", color: "var(--erp-text)" }}
                />
              </div>
              {cortBenefSplitWarning && (
                <div style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 5, padding: "4px 8px" }}>
                  Nombre con 3+ palabras — confirma cómo dividirlo entre Nombre y Apellido.
                </div>
              )}
              {cortBenefNuevoPanel && (
                <div style={{ background: "var(--erp-bg)", border: "1.5px solid var(--erp-border)", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7, marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--erp-primary)", textTransform: "uppercase", letterSpacing: ".05em" }}>Registrar cliente</div>
                  <input type="text" placeholder="C.I / Rif (opcional)" value={cortBenefNuevoCi} onChange={(e) => setCortBenefNuevoCi(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 12, background: "var(--erp-surface)", color: "var(--erp-text)" }} />
                  <input type="text" placeholder="Teléfono (opcional)" value={cortBenefNuevoTel} onChange={(e) => setCortBenefNuevoTel(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 12, background: "var(--erp-surface)", color: "var(--erp-text)" }} />
                  <input type="text" placeholder="Dirección (opcional)" value={cortBenefNuevoDir} onChange={(e) => setCortBenefNuevoDir(e.target.value)} style={{ padding: "6px 10px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 12, background: "var(--erp-surface)", color: "var(--erp-text)" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" disabled={cortBenefGuardando} onClick={async () => {
                      const nombre = toTitleCase(cortBenefNombre);
                      const apellido = toTitleCase(cortBenefApellido);
                      if (!nombre) return;
                      setCortBenefGuardando(true);
                      try {
                        const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, apellido, cedula: cortBenefNuevoCi, telefono: cortBenefNuevoTel, direccion: cortBenefNuevoDir }) });
                        if (res.ok) { setCortBenefNuevoPanel(false); setCortBenefNuevoCi(""); setCortBenefNuevoTel(""); setCortBenefNuevoDir(""); }
                      } finally { setCortBenefGuardando(false); }
                    }} style={{ padding: "5px 12px", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {cortBenefGuardando ? "Guardando..." : "Guardar cliente"}
                    </button>
                    <button type="button" onClick={() => setCortBenefNuevoPanel(false)} style={{ padding: "5px 12px", background: "none", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "var(--erp-text-2)" }}>
                      Continuar sin registrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Productos */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)", marginBottom: 8 }}>Productos a entregar</div>
            <div style={{ border: "1.5px solid var(--erp-border)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 36px", gap: 8, padding: "7px 12px", background: "var(--erp-bg)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)" }}>
                <div>Producto</div>
                <div>Cantidad</div>
                <div />
              </div>
              {cortItems.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 110px 36px", gap: 8, padding: "8px 12px", borderTop: "1px solid var(--erp-border)", alignItems: "center" }}>
                  <select
                    value={item.productoId}
                    onChange={(e) => {
                      const next = [...cortItems];
                      next[idx] = { ...next[idx], productoId: e.target.value };
                      setCortItems(next);
                    }}
                    required={idx === 0}
                    style={{ padding: "6px 8px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 12.5, background: "var(--erp-surface)", color: "var(--erp-text)", width: "100%" }}
                  >
                    <option value="">— Seleccionar producto —</option>
                    {productos.filter((p) => p.stockActual > 0 || item.productoId === String(p.id)).map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.nombre} (stock: {p.stockActual})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => {
                      const next = [...cortItems];
                      next[idx] = { ...next[idx], cantidad: e.target.value };
                      setCortItems(next);
                    }}
                    style={{ padding: "6px 8px", border: "1px solid var(--erp-border)", borderRadius: 6, fontSize: 12.5, background: "var(--erp-surface)", color: "var(--erp-text)", width: "100%", textAlign: "right" }}
                  />
                  <button
                    type="button"
                    onClick={() => setCortItems(cortItems.filter((_, i) => i !== idx))}
                    disabled={cortItems.length === 1}
                    style={{ width: 28, height: 28, border: "1px solid var(--erp-border)", borderRadius: 6, background: "var(--erp-bg)", color: "var(--erp-text-3)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", opacity: cortItems.length === 1 ? 0.3 : 1 }}
                  >✕</button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCortItems([...cortItems, { productoId: "", cantidad: "1" }])}
              style={{ marginTop: 8, width: "100%", padding: "8px 12px", background: "var(--erp-bg)", border: "1.5px dashed var(--erp-border)", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "var(--erp-text-2)", fontWeight: 600 }}
            >+ Agregar producto</button>
          </div>

          {/* Motivo */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--erp-text-3)" }}>Motivo / descripción</label>
            <textarea
              value={cortMotivo}
              onChange={(e) => setCortMotivo(e.target.value)}
              placeholder="Ej: Cortesía por fidelidad — cliente lleva 1 año con nosotros"
              rows={3}
              style={{ padding: "8px 11px", border: "1.5px solid var(--erp-border)", borderRadius: 7, fontSize: 13, background: "var(--erp-surface)", color: "var(--erp-text)", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {/* Aviso */}
          <div style={{ background: "var(--erp-primary-lt)", border: "1.5px solid var(--erp-primary)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--erp-text-2)", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span>🎁</span>
            <div>Esta salida <strong>descuenta el inventario</strong> pero <strong>no genera ingreso ni cobro</strong>. Quedará registrada en el historial de salidas con el tipo seleccionado.</div>
          </div>

          {cortError && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 7, padding: "9px 13px", fontSize: 12.5, color: "#DC2626" }}>{cortError}</div>
          )}
          {cortSuccess && (
            <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 7, padding: "9px 13px", fontSize: 12.5, color: "#15803D", fontWeight: 600 }}>✓ Salida registrada correctamente. El inventario fue actualizado.</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={cortSaving}
              style={{ flex: 1, padding: "10px 20px", background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: cortSaving ? 0.6 : 1 }}
            >{cortSaving ? "Guardando…" : cortEditingId ? "✓ Guardar cambios" : "✓ Registrar Salida Gratuita"}</button>
            <button
              type="button"
              onClick={() => { setCortEditingId(null); setCortItems([{ productoId: "", cantidad: "1" }]); setCortBeneficiario(""); setCortMotivo(""); setCortTipo("CORTESIA"); setCortError(null); setCortSuccess(false); }}
              style={{ padding: "10px 16px", background: "var(--erp-surface)", color: "var(--erp-text-2)", border: "1.5px solid var(--erp-border)", borderRadius: 7, fontSize: 13, cursor: "pointer" }}
            >Limpiar</button>
          </div>

          {/* ── Historial de salidas ── */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--erp-text-3)", flex: 1 }}>Historial de salidas registradas</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "var(--erp-text-3)" }}>Mostrar:</span>
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setCortPorPagina(n); setCortPagina(1); }}
                    style={{
                      padding: "3px 10px", borderRadius: 5, border: "1px solid var(--erp-border)", fontSize: 12, cursor: "pointer",
                      background: cortPorPagina === n ? "var(--erp-primary)" : "var(--erp-surface)",
                      color: cortPorPagina === n ? "#fff" : "var(--erp-text-2)",
                      fontWeight: cortPorPagina === n ? 700 : 400,
                    }}
                  >{n}</button>
                ))}
              </div>
            </div>

            {cortHistLoading ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>Cargando historial…</div>
            ) : cortHistorial.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--erp-text-3)", fontSize: 13 }}>No hay salidas registradas aún.</div>
            ) : (() => {
              const totalPags = Math.ceil(cortHistorial.length / cortPorPagina);
              const pagActual = Math.min(cortPagina, totalPags);
              const filas = cortHistorial.slice((pagActual - 1) * cortPorPagina, pagActual * cortPorPagina);
              const tipoPill: Record<string, { bg: string; color: string }> = {
                CORTESIA:  { bg: "#EDE9FE", color: "#6D28D9" },
                SORTEO:    { bg: "#FEF9C3", color: "#92400E" },
                MUESTRA:   { bg: "#E0F2FE", color: "#0369A1" },
                EVENTO:    { bg: "#FCE7F3", color: "#9D174D" },
                FIDELIDAD: { bg: "#FEF3C7", color: "#92400E" },
              };
              return (
                <>
                  {/* Tarjetas móvil */}
                  <div className="flex flex-col gap-2 sm:hidden">
                    {filas.map((s) => {
                      const pill = tipoPill[s.tipo] ?? { bg: "var(--erp-bg)", color: "var(--erp-text-2)" };
                      return (
                        <div key={s.id} style={{ border: "1.5px solid var(--erp-border)", borderRadius: 8, padding: "10px 12px", background: "var(--erp-surface)", opacity: s.anulada ? 0.6 : 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>#{s.id}</span>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: pill.bg, color: pill.color }}>{s.tipo}</span>
                              {s.anulada
                                ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: "#FEE2E2", color: "#DC2626" }}>ANULADA</span>
                                : <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 800, background: "#DCFCE7", color: "#15803D" }}>ACTIVA</span>
                              }
                            </div>
                            <span style={{ fontSize: 11, color: "var(--erp-text-3)" }}>{s.fecha ? s.fecha.slice(0, 10) : "—"}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--erp-text-2)", marginBottom: 4 }}>
                            {s.items?.map((it, i) => <span key={i}>{i > 0 ? ", " : ""}{it.cantidad}× {it.nombre}</span>)}
                          </div>
                          {s.beneficiario && <div style={{ fontSize: 11, color: "var(--erp-text-3)", marginBottom: 2 }}>Para: {s.beneficiario}</div>}
                          {!s.anulada && (
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <button type="button" onClick={() => startCortEdit(s)}
                                style={{ flex: 1, padding: "5px 0", background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "1px solid var(--erp-primary)", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Editar</button>
                              <button type="button" onClick={() => handleAnularSalida(s.id)} disabled={cortAnulando === s.id}
                                style={{ flex: 1, padding: "5px 0", background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5", borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: cortAnulando === s.id ? 0.6 : 1 }}>{cortAnulando === s.id ? "…" : "Anular"}</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Tabla desktop */}
                  <div className="hidden sm:block" style={{ overflowX: "auto", border: "1.5px solid var(--erp-border)", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "var(--erp-bg)" }}>
                          {["#", "Fecha", "Tipo", "Productos", "Beneficiario", "Responsable", "Estado", ""].map((h) => (
                            <th key={h} style={{ padding: "7px 11px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--erp-text-3)", borderBottom: "1.5px solid var(--erp-border)", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filas.map((s) => {
                          const pill = tipoPill[s.tipo] ?? { bg: "var(--erp-bg)", color: "var(--erp-text-2)" };
                          return (
                            <tr key={s.id} style={{ borderBottom: "1px solid var(--erp-border)", opacity: s.anulada ? 0.5 : 1 }}>
                              <td style={{ padding: "8px 11px", color: "var(--erp-text-3)", fontVariantNumeric: "tabular-nums" }}>#{s.id}</td>
                              <td style={{ padding: "8px 11px", whiteSpace: "nowrap" }}>{s.fecha ? s.fecha.slice(0, 10) : "—"}</td>
                              <td style={{ padding: "8px 11px" }}>
                                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: pill.bg, color: pill.color, whiteSpace: "nowrap" }}>{s.tipo}</span>
                              </td>
                              <td style={{ padding: "8px 11px", maxWidth: 200 }}>
                                {s.items?.map((it, i) => (
                                  <div key={i} style={{ fontSize: 11.5, color: "var(--erp-text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {it.cantidad}× {it.nombre}
                                  </div>
                                ))}
                              </td>
                              <td style={{ padding: "8px 11px", color: "var(--erp-text-2)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.beneficiario || "—"}</td>
                              <td style={{ padding: "8px 11px", color: "var(--erp-text-2)", whiteSpace: "nowrap" }}>{s.responsable || "—"}</td>
                              <td style={{ padding: "8px 11px" }}>
                                {s.anulada
                                  ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: "#FEE2E2", color: "#DC2626" }}>ANULADA</span>
                                  : <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: "#DCFCE7", color: "#15803D" }}>ACTIVA</span>
                                }
                              </td>
                              <td style={{ padding: "8px 11px" }}>
                                {!s.anulada && (
                                  <div style={{ display: "flex", gap: 5 }}>
                                    <button type="button" onClick={() => startCortEdit(s)}
                                      style={{ padding: "4px 10px", background: "var(--erp-primary-lt)", color: "var(--erp-primary)", border: "1px solid var(--erp-primary)", borderRadius: 5, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Editar</button>
                                    <button type="button" onClick={() => handleAnularSalida(s.id)} disabled={cortAnulando === s.id}
                                      style={{ padding: "4px 10px", background: "#FEE2E2", color: "#DC2626", border: "1px solid #FCA5A5", borderRadius: 5, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", opacity: cortAnulando === s.id ? 0.6 : 1 }}>{cortAnulando === s.id ? "…" : "Anular"}</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginación */}
                  {totalPags > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 10 }}>
                      <button type="button" onClick={() => setCortPagina((p) => Math.max(1, p - 1))} disabled={pagActual === 1}
                        style={{ padding: "4px 10px", border: "1px solid var(--erp-border)", borderRadius: 5, background: "var(--erp-surface)", cursor: "pointer", fontSize: 12, color: "var(--erp-text-2)", opacity: pagActual === 1 ? 0.4 : 1 }}>← Ant</button>
                      <span style={{ fontSize: 12, color: "var(--erp-text-2)" }}>Pág {pagActual} / {totalPags}</span>
                      <button type="button" onClick={() => setCortPagina((p) => Math.min(totalPags, p + 1))} disabled={pagActual === totalPags}
                        style={{ padding: "4px 10px", border: "1px solid var(--erp-border)", borderRadius: 5, background: "var(--erp-surface)", cursor: "pointer", fontSize: 12, color: "var(--erp-text-2)", opacity: pagActual === totalPags ? 0.4 : 1 }}>Sig →</button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </form>
      )}

      {vista === "ventas" && modoVista === "pasos" && (
        <>
          {/* Barra de indicadores — siempre visible */}
          {(
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-16 bg-transparent text-sm font-bold outline-none"
                  style={{ color: "var(--erp-text)" }}
                  placeholder="0.00"
                  id="conversor-usd"
                  onChange={(e) => {
                    const usd = Number(e.target.value);
                    const tasa = Number(tasaDelDia) || 0;
                    const bsEl = document.getElementById("conversor-bs") as HTMLInputElement | null;
                    if (bsEl) bsEl.value = usd > 0 && tasa > 0 ? (usd * tasa).toFixed(2) : "";
                  }}
                />
                <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>=</span>
                <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>Bs</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-20 bg-transparent text-sm font-bold outline-none"
                  style={{ color: "var(--erp-text-2)" }}
                  placeholder="0.00"
                  id="conversor-bs"
                  onChange={(e) => {
                    const bs = Number(e.target.value);
                    const tasa = Number(tasaDelDia) || 0;
                    const usdEl = document.getElementById("conversor-usd") as HTMLInputElement | null;
                    if (usdEl) usdEl.value = bs > 0 && tasa > 0 ? (bs / tasa).toFixed(2) : "";
                  }}
                />
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>BCV</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  className="w-20 bg-transparent text-sm font-bold outline-none"
                  style={{ color: "var(--erp-text)" }}
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
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>Venta Hoy</span>
                <span className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>{ventaHoy != null ? `$${ventaHoy.toFixed(2)}` : "—"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>Ingresos</span>
                <span className="text-sm font-bold" style={{ color: "var(--erp-text)" }}>{ingresos != null ? `$${ingresos.toFixed(2)}` : "—"}</span>
              </div>
              {(() => {
                const totalHoy = ventaHoy != null && ingresos != null ? ventaHoy + ingresos : null;
                const verde = totalHoy != null && totalHoy > metaTotalHoy;
                const color = verde ? "#16a34a" : "var(--erp-primary)";
                const bg = verde ? "#dcfce7" : "var(--erp-primary-lt)";
                const border = verde ? "#16a34a" : "var(--erp-primary)";
                return (
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: border, background: bg }}>
                    <span className="text-xs font-medium" style={{ color }}>Total Hoy</span>
                    <span className="text-sm font-bold" style={{ color }}>
                      {totalHoy != null ? `$${totalHoy.toFixed(2)}` : "—"}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Banner modo edición */}
          {editingId && (
            <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
              <span className="text-sm font-medium text-amber-800">✏️ Editando venta #{editingId}</span>
              <button type="button" onClick={cancelEdit} className="rounded-md border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">Cancelar</button>
            </div>
          )}

          {/* ── Horizontal stepper ── */}
          {(() => {
            const steps = ordenPasos === "entrega_primero"
              ? ["Productos", "Entrega", "Formas de Pago", "Cliente"]
              : ordenPasos === "cliente_primero"
              ? ["Cliente", "Productos", "Entrega", "Formas de Pago"]
              : ["Productos", "Formas de Pago", "Entrega", "Cliente"];
            return (
              <div className="flex items-start">
                {steps.map((label, i) => {
                  const num = i + 1;
                  const active = pasoActual === num;
                  const done = pasoActual > num;
                  return (
                    <div key={i} className="flex items-center flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setPasoActual(num)}
                        className="flex flex-col items-center gap-1 flex-1 min-w-0 py-1"
                      >
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors"
                          style={done ? { background: "#22c55e", color: "#fff" } : active ? { background: "var(--erp-primary)", color: "#fff" } : { background: "var(--erp-border)", color: "var(--erp-text-3)" }}
                        >
                          {done ? "✓" : num}
                        </span>
                        <span
                          className="text-[10px] font-medium text-center leading-tight px-1 truncate w-full"
                          style={{ color: active ? "var(--erp-primary)" : done ? "#16a34a" : "var(--erp-text-3)" }}
                        >
                          {label}
                        </span>
                      </button>
                      {i < steps.length - 1 && (
                        <div className="h-px w-4 shrink-0 mx-0.5 mt-[-10px]" style={{ background: done ? "#22c55e" : "var(--erp-border)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* ── PASO ACTIVO content card ── */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--erp-border)", borderTopColor: "var(--erp-primary)", borderTopWidth: "3px", background: "var(--erp-surface)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--erp-border)" }}>
                <span className="font-semibold text-sm" style={{ color: "var(--erp-text)" }}>
                  {(() => {
                    const titles = ordenPasos === "entrega_primero"
                      ? ["Productos del Pedido", "Parámetros de Entrega", "Formas de Pago", "Datos del Cliente"]
                      : ordenPasos === "cliente_primero"
                      ? ["Datos del Cliente", "Productos del Pedido", "Parámetros de Entrega", "Formas de Pago"]
                      : ["Productos del Pedido", "Formas de Pago", "Parámetros de Entrega", "Datos del Cliente"];
                    return titles[pasoActual - 1];
                  })()}
                </span>
              </div>
              <div className="px-4 pb-4 pt-3 flex flex-col gap-3">

            {/* PASO 1 — Productos del Pedido */}
            {((pasoActual === 1 && ordenPasos !== "cliente_primero") || (pasoActual === 2 && ordenPasos === "cliente_primero")) && (
              <div className="flex flex-col gap-3">
                  <div>
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
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-zinc-700">Producto</label>
                                {producto && (
                                  <span className={`text-xs font-medium ${producto.stockActual <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                                    Stock: {producto.stockActual} {producto.unidadMedida}
                                    {producto.stockActual <= 0 && producto.empaques && producto.empaques.length > 0 && (
                                      <span className="ml-1 text-amber-600">· 📦 empaque disponible</span>
                                    )}
                                  </span>
                                )}
                              </div>
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
                                  // Detectar stock cero con empaque disponible
                                  if (match && match.stockActual <= 0 && match.empaques && match.empaques.length > 0) {
                                    const empaquesConStock = match.empaques.filter(e => e.empaqueStock > 0);
                                    if (empaquesConStock.length > 0) {
                                      setModalEmpaque({
                                        itemIndex: index,
                                        producto: match,
                                        empaques: empaquesConStock,
                                        seleccionado: empaquesConStock[0].id,
                                        abriendo: false,
                                        error: null,
                                      });
                                    }
                                  }
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
                  <div className="text-sm font-medium text-right" style={{ color: "var(--erp-text-2)" }}>
                    Subtotal: <span className="font-bold" style={{ color: "var(--erp-text)" }}>${totales.ventaTotalConDescuentoUsd.toFixed(2)}</span>
                  </div>
              </div>
            )}

            {/* PASO 2/3 — Formas de pago */}
            {pasoActual === (ordenPasos === "entrega_primero" ? 3 : ordenPasos === "cliente_primero" ? 4 : 2) && (
              <div className="flex flex-col gap-4">
                  {/* Payment method tiles */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--erp-text-3)" }}>Selecciona forma de pago</span>
                      {pagos.length > 1 && <button type="button" onClick={addPago} className="text-xs font-medium" style={{ color: "var(--erp-primary)" }}>+ Agregar método</button>}
                    </div>
                    <div className="flex flex-col gap-3">
                      {pagos.map((pago, index) => (
                        <div key={index} className="flex flex-col gap-2">
                          {pagos.length > 1 && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium" style={{ color: "var(--erp-text-3)" }}>Método {index + 1}</span>
                              <button type="button" onClick={() => removePago(index)} className="text-xs text-red-500">Eliminar</button>
                            </div>
                          )}
                          {/* Tiles grid */}
                          <div className="grid grid-cols-4 gap-2">
                            {METODOS_PAGO.map((m) => {
                              const sel = pago.metodo === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => updatePago(index, { metodo: m, montoAuto: true })}
                                  className="flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all"
                                  style={sel ? { borderColor: "var(--erp-primary)", background: "var(--erp-primary-lt)", color: "var(--erp-primary)" } : { borderColor: "var(--erp-border)", background: "var(--erp-surface)", color: "var(--erp-text-2)" }}
                                >
                                  {METODO_PAGO_ICONS[m] === "__zelle__" ? (
                                    <ZelleIcon size={26} />
                                  ) : METODO_PAGO_ICONS[m] === "__yummy__" ? (
                                    <YummyIcon size={26} />
                                  ) : (
                                    <span className="text-xl leading-none">{METODO_PAGO_ICONS[m]}</span>
                                  )}
                                  <span className="text-[10px] font-medium text-center leading-tight">{METODO_PAGO_LABELS[m]}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* Monto input — shown when method is selected */}
                          {pago.metodo && pago.metodo !== "CASHEA" && pago.metodo !== "YUMMY" && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium" style={{ color: "var(--erp-text-2)" }}>
                                  {METODOS_PAGO_USD.includes(pago.metodo as typeof METODOS_PAGO_USD[number]) ? "Monto ($)" : "Monto (Bs)"}
                                </span>
                                <input
                                  type="number" step="0.01" min="0"
                                  className="w-32 rounded-md border px-3 py-2 text-sm"
                                  value={pago.montoAuto ? (pago.metodo ? totales.montoSugerido(index).toFixed(2) : "") : pago.monto}
                                  onChange={(e) => updatePago(index, { monto: e.target.value, montoAuto: false })}
                                  placeholder="Monto"
                                />
                              </div>
                              {(() => {
                                const montoRaw = pago.montoAuto ? totales.montoSugerido(index) : Number(pago.monto) || 0;
                                const tasa = Number(tasaDelDia) || 0;
                                const esUsd = METODOS_PAGO_USD.includes(pago.metodo as typeof METODOS_PAGO_USD[number]);
                                if (!montoRaw || !tasa) return null;
                                return (
                                  <span className="ml-1 text-xs" style={{ color: "var(--erp-text-3)" }}>
                                    {esUsd
                                      ? <>≈ Bs {(montoRaw * tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                      : <>≈ ${(montoRaw / tasa).toFixed(2)}</>
                                    }
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                          {/* keep the old code for CASHEA and YUMMY details below */}
                          {pago.metodo === "CASHEA" && (
                            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 flex flex-col gap-2">
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
                                    {METODOS_PAGO.filter((m) => m !== "CASHEA" && m !== "YUMMY").map((m) => <option key={m} value={m}>{METODO_PAGO_LABELS[m]}</option>)}
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
                          {pago.metodo === "YUMMY" && (
                            <div className="rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "#00c853", backgroundColor: "#f0faf4" }}>
                              <div className="flex flex-wrap gap-3">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-zinc-600">Días de pago</label>
                                  <select value={yummyDiasSeleccion} onChange={(e) => setYummyDiasSeleccion(e.target.value)} className="rounded-md border border-zinc-300 px-2 py-1 text-sm w-24">
                                    {yummyDiasOpciones.map((d) => <option key={d} value={d}>{d} días</option>)}
                                  </select>
                                </div>
                              </div>
                              {(() => {
                                const dias = Number(yummyDiasSeleccion) || 2;
                                const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                                const vence = addDays(fecha, dias);
                                return (
                                  <div className="flex flex-wrap gap-3 text-xs text-zinc-700">
                                    <span>Monto por cobrar a Yummy: <strong style={{ color: "#007e33" }}>${total.toFixed(2)}</strong></span>
                                    <span>Vence: <strong>{vence}</strong></span>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                      {pagos.length < 3 && (
                        <button type="button" onClick={addPago} className="self-start text-xs font-medium px-3 py-1.5 rounded-md border transition-colors" style={{ borderColor: "var(--erp-border)", color: "var(--erp-primary)" }}>
                          + Agregar otro método
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Cuenta por cobrar */}
                  {pagos.every((p) => !p.metodo) && (
                    <div className="rounded-md border p-3" style={errorPlazoPago ? { borderColor: "#FCA5A5", background: "#FEF2F2" } : { borderColor: "var(--erp-primary)", background: "var(--erp-primary-lt)" }}>
                      <button type="button" onClick={() => setMostrarCuentaPorCobrar((prev) => !prev)} className="flex w-full items-center justify-between text-left text-sm font-semibold" style={{ color: errorPlazoPago ? "#991B1B" : "var(--erp-primary)" }}>
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
                  {/* Totals panel */}
                  {(() => {
                    const tieneCashea = pagos.some((p) => p.metodo === "CASHEA");
                    const tieneYummy = pagos.some((p) => p.metodo === "YUMMY");
                    const totalBase = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                    const pct = Number(casheaPorcentaje) || 50;
                    const casheaInicialUsd = tieneCashea ? totalBase * pct / 100 : 0;
                    const casheaFinanciadoUsd = tieneCashea ? totalBase - casheaInicialUsd : 0;
                    const tasaN = Number(tasaDelDia) || 1;
                    const pagadoUsd = tieneCashea ? casheaInicialUsd : tieneYummy ? 0 : totales.totalPagosEnUsd;
                    const pagadoBs = pagadoUsd * tasaN;
                    return (
                      <div className="rounded-xl border p-4 flex flex-col gap-2" style={{ borderColor: "var(--erp-border)", background: "var(--erp-bg)" }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--erp-text-3)" }}>Resumen</span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                          <div className="flex justify-between col-span-2"><span style={{ color: "var(--erp-text-2)" }}>Subtotal venta</span><span className="font-medium tabular-nums" style={{ color: "var(--erp-text)" }}>${totales.ventaTotalUsd.toFixed(2)}</span></div>
                          {totales.descuento > 0 && <div className="flex justify-between col-span-2"><span className="text-green-600">Descuento</span><span className="font-medium text-green-600 tabular-nums">−${(totales.ventaTotalUsd - totales.ventaTotalConDescuentoUsd).toFixed(2)}</span></div>}
                          {modoEntrega === "DELIVERY" && <div className="flex justify-between col-span-2"><span style={{ color: "var(--erp-text-2)" }}>Delivery</span><span className="font-medium tabular-nums" style={{ color: "var(--erp-text)" }}>${totales.costoDeliveryUsd.toFixed(2)}</span></div>}
                          <div className="flex justify-between col-span-2 border-t pt-1.5" style={{ borderColor: "var(--erp-border)" }}>
                            <span className="font-semibold" style={{ color: "var(--erp-text)" }}>Total a pagar</span>
                            <span className="font-bold tabular-nums" style={{ color: "var(--erp-primary)" }}>${totales.totalAPagarUsd.toFixed(2)} · {totales.totalAPagarBs.toFixed(2)} Bs</span>
                          </div>
                          {!tieneYummy && <div className="flex justify-between col-span-2"><span style={{ color: "var(--erp-text-2)" }}>Total pagado</span><span className="font-medium tabular-nums" style={{ color: "var(--erp-text)" }}>${pagadoUsd.toFixed(2)} · {pagadoBs.toFixed(2)} Bs</span></div>}
                          {tieneCashea && <div className="flex justify-between col-span-2"><span className="text-yellow-700">CxC Cashea</span><span className="font-semibold text-yellow-700 tabular-nums">${casheaFinanciadoUsd.toFixed(2)}</span></div>}
                          {tieneYummy && <div className="flex justify-between col-span-2"><span style={{ color: "#007e33" }}>CxC Yummy</span><span className="font-semibold tabular-nums" style={{ color: "#007e33" }}>${totalBase.toFixed(2)}</span></div>}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            )}


            {/* PASO 3/2 — Parámetros de entrega */}
            {pasoActual === (ordenPasos === "entrega_primero" ? 2 : 3) && (
              <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-zinc-700">Modo de entrega</label>
                      <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={modoEntrega} onChange={(e) => handleModoEntrega(e.target.value as ModoEntrega)}>
                        <option value="LOCAL">Local</option>
                        <option value="DELIVERY">Delivery</option>
                        <option value="PICK_UP">Pick-Up</option>
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
                        <input type="number" step="0.01" min="0" className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50" value={costoDelivery} onChange={(e) => setCostoDelivery(e.target.value)} disabled={tipoDelivery === "YUMMY"} />
                      </div>
                    )}
                  </div>

                  {/* Hora y avisos — siempre visible para Delivery y Pick-Up */}
                  {(modoEntrega === "DELIVERY" || modoEntrega === "PICK_UP") && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium text-zinc-700">Fecha de entrega</label>
                        <input type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} required />
                      </div>
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
                      {modoEntrega === "DELIVERY" && (
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-medium text-zinc-700">Delivery asignado</label>
                          <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={motorizadoId} onChange={(e) => setMotorizadoId(e.target.value)}>
                            <option value="">Sin asignar</option>
                            {motorizados.map((m) => <option key={m.id} value={m.id}>{m.apellido ? `${m.nombre} ${m.apellido}` : m.nombre}</option>)}
                          </select>
                        </div>
                      )}
                      {horaPreparacionDate && <div className="flex flex-col justify-end text-sm text-zinc-600 sm:col-span-4">Alarma preparación: <span className="font-medium">{pad(horaPreparacionDate.getHours())}:{pad(horaPreparacionDate.getMinutes())}</span></div>}
                      {horaRetiroDate && <div className="flex flex-col justify-end text-sm text-zinc-600 sm:col-span-4">Alarma retiro: <span className="font-medium">{pad(horaRetiroDate.getHours())}:{pad(horaRetiroDate.getMinutes())}</span></div>}
                    </div>
                  )}
              </div>
            )}

            {/* PASO 4 — Datos del Cliente */}
            {pasoActual === (ordenPasos === "cliente_primero" ? 1 : 4) && (
              <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                      <label className="text-sm font-medium text-zinc-700">Nombre</label>
                      <div className="flex gap-1">
                        <input className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={clienteNombre} onChange={(e) => { setClienteNombre(e.target.value); buscarClientes((e.target.value + " " + clienteApellido).trim() || clienteCi); }} onBlur={(e) => setClienteNombre(toTitleCase(e.target.value))} onFocus={() => clientesResultados.length > 0 && setMostrarResultados(true)} placeholder="Nombre" required />
                        <input className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={clienteApellido} onChange={(e) => setClienteApellido(e.target.value)} onBlur={(e) => setClienteApellido(toTitleCase(e.target.value))} placeholder="Apellido" />
                      </div>
                      {clienteSplitWarning && <span className="text-xs" style={{ color: "#92400e", background: "#fef3c7", borderRadius: 4, padding: "2px 6px" }}>Nombre con 3+ palabras — confirma la división.</span>}
                      {puedeMostrarResultados && clientesResultados.length > 0 && (
                        <ul className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                          {clientesResultados.map((c) => (
                            <li key={c.id}>
                              <button type="button" onClick={() => seleccionarCliente(c)} className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-100">
                                <span className="font-medium">{c.nombre}{c.apellido ? " " + c.apellido : ""}</span>
                                <span className="text-xs text-zinc-500">{c.cedula ?? "Sin C.I/Rif"}{c.telefono ? ` · ${c.telefono}` : ""}{c.direccion ? ` · ${c.direccion}` : ""}</span>
                              </button>
                            </li>
                          ))}
                          <li>
                            <button type="button" onClick={() => { setMostrarResultados(false); setClienteNuevoPanel(true); }} className="flex w-full items-start px-3 py-2 text-left text-sm font-semibold" style={{ color: "var(--erp-primary)", borderTop: "1px solid var(--erp-border)" }}>+ Registrar nuevo cliente</button>
                          </li>
                        </ul>
                      )}
                      {clienteNuevoPanel && (
                        <div className="mt-1 rounded-md border p-3 flex flex-col gap-2" style={{ borderColor: "var(--erp-border)", background: "var(--erp-bg)" }}>
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--erp-primary)" }}>Registrar como nuevo cliente</span>
                          <input className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" placeholder="C.I / Rif (obligatorio)" value={clienteCi} onChange={(e) => setClienteCi(e.target.value)} />
                          <input className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" placeholder="Teléfono (opcional)" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
                          <input className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" placeholder="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                          <div className="flex gap-2">
                            <button type="button" className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--erp-primary)" }} onClick={async () => {
                              const n = toTitleCase(clienteNombre); const a = toTitleCase(clienteApellido);
                              if (!n) return;
                              const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: n, apellido: a, cedula: clienteCi, telefono: clienteTelefono, direccion }) });
                              if (res.ok) { setClienteNuevoPanel(false); }
                            }}>Guardar cliente</button>
                            <button type="button" className="rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }} onClick={() => setClienteNuevoPanel(false)}>Continuar sin registrar</button>
                          </div>
                        </div>
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

              </div>{/* end px-4 pb-4 content card */}
            </div>{/* end content card */}

            {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

            {/* Wizard navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPasoActual(p => Math.max(1, p - 1))}
                className="rounded-md border px-4 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}
                disabled={pasoActual === 1}
              >
                ← Anterior
              </button>
              {pasoActual < 4 ? (
                <button
                  type="button"
                  onClick={() => setPasoActual(p => Math.min(4, p + 1))}
                  className="flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
                  style={{ background: "var(--erp-primary)" }}
                >
                  Siguiente →
                </button>
              ) : (
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: "var(--erp-primary)" }}>
                    {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar venta"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="rounded-md border px-4 py-2 text-sm font-medium transition-colors" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }}>Cancelar</button>
                  )}
                </div>
              )}
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border p-4" style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}>
        <div className="flex flex-col gap-3 rounded-md border p-3" style={{ borderColor: "var(--erp-primary-lt)", background: "var(--erp-primary-lt)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--erp-primary)" }}>Información del cliente</h3>
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
            <label className="text-sm font-medium text-zinc-700">Nombre / Apellido</label>
            <div className="flex gap-1">
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={clienteNombre}
                onChange={(e) => { setClienteNombre(e.target.value); buscarClientes((e.target.value + " " + clienteApellido).trim() || clienteCi); }}
                onBlur={(e) => setClienteNombre(toTitleCase(e.target.value))}
                onFocus={() => clientesResultados.length > 0 && setMostrarResultados(true)}
                placeholder="Nombre"
                required
              />
              <input
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={clienteApellido}
                onChange={(e) => setClienteApellido(e.target.value)}
                onBlur={(e) => setClienteApellido(toTitleCase(e.target.value))}
                placeholder="Apellido"
              />
            </div>
            {clienteSplitWarning && <span className="text-xs rounded px-1.5 py-0.5" style={{ color: "#92400e", background: "#fef3c7" }}>Nombre con 3+ palabras — confirma la división.</span>}
            {puedeMostrarResultados && clientesResultados.length > 0 && (
              <ul className="absolute top-full left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                {clientesResultados.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-zinc-100"
                    >
                      <span className="font-medium">{c.nombre}{c.apellido ? " " + c.apellido : ""}</span>
                      <span className="text-xs text-zinc-500">
                        {c.cedula ?? "Sin C.I/Rif"}
                        {c.telefono ? ` · ${c.telefono}` : ""}
                        {c.direccion ? ` · ${c.direccion}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" onClick={() => { setMostrarResultados(false); setClienteNuevoPanel(true); }} className="flex w-full items-start px-3 py-2 text-left text-sm font-semibold" style={{ color: "var(--erp-primary)", borderTop: "1px solid var(--erp-border)" }}>
                    + Registrar nuevo cliente
                  </button>
                </li>
              </ul>
            )}
            {clienteNuevoPanel && (
              <div className="mt-1 rounded-md border p-3 flex flex-col gap-2" style={{ borderColor: "var(--erp-border)", background: "var(--erp-bg)" }}>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--erp-primary)" }}>Registrar como nuevo cliente</span>
                <input className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" placeholder="C.I / Rif (opcional)" value={clienteCi} onChange={(e) => setClienteCi(e.target.value)} />
                <input className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" placeholder="Teléfono (opcional)" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} />
                <input className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" placeholder="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" className="rounded-md px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--erp-primary)" }} onClick={async () => {
                    const n = toTitleCase(clienteNombre); const a = toTitleCase(clienteApellido);
                    if (!n) return;
                    const res = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: n, apellido: a, cedula: clienteCi, telefono: clienteTelefono, direccion }) });
                    if (res.ok) { setClienteNuevoPanel(false); }
                  }}>Guardar cliente</button>
                  <button type="button" className="rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: "var(--erp-border)", color: "var(--erp-text-2)" }} onClick={() => setClienteNuevoPanel(false)}>Continuar sin registrar</button>
                </div>
              </div>
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

        <div className="flex flex-col gap-3 rounded-md border p-3" style={{ borderColor: "var(--erp-primary-lt)", background: "var(--erp-primary-lt)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--erp-primary)" }}>Parámetros de entrega</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Modo de entrega</label>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                value={modoEntrega}
                onChange={(e) => handleModoEntrega(e.target.value as ModoEntrega)}
              >
                <option value="LOCAL">Local</option>
                <option value="DELIVERY">Delivery</option>
                <option value="PICK_UP">Pick-Up</option>
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
          {(modoEntrega === "DELIVERY" || modoEntrega === "PICK_UP") && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700">Fecha de entrega</label>
                <input type="date" className="rounded-md border border-zinc-300 px-3 py-2 text-sm" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} required />
              </div>
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
              {modoEntrega === "DELIVERY" && (
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
              )}
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
                  {producto && (
                    <div className="col-span-12 -mb-1 flex items-center gap-2">
                      <span className={`text-xs font-medium ${producto.stockActual <= 0 ? "text-red-600" : "text-zinc-500"}`}>
                        Stock disponible: {producto.stockActual} {producto.unidadMedida}
                      </span>
                      {producto.stockActual <= 0 && producto.empaques && producto.empaques.length > 0 && (
                        <span className="text-xs text-amber-600">· 📦 empaque disponible</span>
                      )}
                    </div>
                  )}
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
                      // Verificar si hay stock cero con empaques disponibles
                      if (match && match.stockActual <= 0 && match.empaques && match.empaques.length > 0) {
                        const empaquesConStock = match.empaques.filter(e => e.empaqueStock > 0);
                        if (empaquesConStock.length > 0) {
                          setModalEmpaque({
                            itemIndex: index,
                            producto: match,
                            empaques: empaquesConStock,
                            seleccionado: empaquesConStock[0].id,
                            abriendo: false,
                            error: null,
                          });
                        }
                      }
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
                    readOnly={pago.metodo === "CASHEA" || pago.metodo === "YUMMY"}
                    className={`col-span-4 rounded-md border border-zinc-300 px-3 py-2 text-sm sm:col-span-3 ${(pago.metodo === "CASHEA" || pago.metodo === "YUMMY") ? "bg-zinc-50 text-zinc-500" : ""}`}
                    value={
                      pago.metodo === "CASHEA"
                        ? (() => {
                            const pct = Number(casheaPorcentaje) || 50;
                            const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                            return (total * pct / 100).toFixed(2);
                          })()
                        : pago.metodo === "YUMMY"
                          ? (totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd).toFixed(2)
                          : pago.montoAuto
                            ? pago.metodo
                              ? totales.montoSugerido(index).toFixed(2)
                              : ""
                            : pago.monto
                    }
                    onChange={(e) => {
                      if (pago.metodo !== "CASHEA" && pago.metodo !== "YUMMY") updatePago(index, { monto: e.target.value, montoAuto: false });
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
                {/* Conversión $↔Bs en tiempo real */}
                {pago.metodo && pago.metodo !== "CASHEA" && pago.metodo !== "YUMMY" && (() => {
                  const montoRaw = pago.montoAuto ? totales.montoSugerido(index) : Number(pago.monto) || 0;
                  const tasa = Number(tasaDelDia) || 0;
                  const esUsd = METODOS_PAGO_USD.includes(pago.metodo as typeof METODOS_PAGO_USD[number]);
                  if (!montoRaw || !tasa) return null;
                  return (
                    <div className="ml-1 text-xs" style={{ color: "var(--erp-text-3)" }}>
                      {esUsd
                        ? <span>≈ Bs {(montoRaw * tasa).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        : <span>≈ ${(montoRaw / tasa).toFixed(2)}</span>
                      }
                    </div>
                  );
                })()}
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
                          {METODOS_PAGO.filter((m) => m !== "CASHEA" && m !== "YUMMY").map((m) => (
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
                {pago.metodo === "YUMMY" && (
                  <div className="ml-0 rounded-lg border p-3 flex flex-col gap-2" style={{ borderColor: "#00c853", backgroundColor: "#f0faf4" }}>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-zinc-600">Días de pago</label>
                        <select
                          value={yummyDiasSeleccion}
                          onChange={(e) => setYummyDiasSeleccion(e.target.value)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-sm w-24"
                        >
                          {yummyDiasOpciones.map((d) => (
                            <option key={d} value={d}>{d} días</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {(() => {
                      const dias = Number(yummyDiasSeleccion) || 2;
                      const total = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
                      const vence = addDays(fecha, dias);
                      return (
                        <div className="flex flex-wrap gap-3 text-xs text-zinc-700">
                          <span>Monto por cobrar a Yummy: <strong style={{ color: "#007e33" }}>${total.toFixed(2)}</strong></span>
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
          const tieneYummy = pagos.some((p) => p.metodo === "YUMMY");
          const totalBase = totales.ventaTotalConDescuentoUsd + totales.costoDeliveryUsd;
          const pct = Number(casheaPorcentaje) || 50;
          const casheaInicialUsd = tieneCashea ? totalBase * pct / 100 : 0;
          const casheaFinanciadoUsd = tieneCashea ? totalBase - casheaInicialUsd : 0;
          const tasa = Number(tasaDelDia) || 1;
          const pagadoUsd = tieneCashea ? casheaInicialUsd : tieneYummy ? 0 : totales.totalPagosEnUsd;
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
              {!tieneYummy && (
                <div>
                  <span className="font-medium text-zinc-600">Total pagado: </span>
                  {pagadoBs.toFixed(2)} Bs{" "}
                  <span className="text-zinc-500">(${pagadoUsd.toFixed(2)})</span>
                </div>
              )}
              {tieneCashea && (
                <div className="sm:col-span-2">
                  <span className="font-medium text-yellow-700">CxC Cashea: </span>
                  <span className="font-semibold text-yellow-800">{(casheaFinanciadoUsd * tasa).toFixed(2)} Bs</span>{" "}
                  <span className="text-zinc-500">(${casheaFinanciadoUsd.toFixed(2)})</span>
                </div>
              )}
              {tieneYummy && (
                <div className="sm:col-span-2">
                  <span className="font-medium" style={{ color: "#007e33" }}>CxC Yummy: </span>
                  <span className="font-semibold" style={{ color: "#007e33" }}>{(totalBase * tasa).toFixed(2)} Bs</span>{" "}
                  <span className="text-zinc-500">(${totalBase.toFixed(2)})</span>
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
            className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50" style={{ background: "var(--erp-primary)" }}
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

      <div className="rounded-lg border" style={{ borderColor: "var(--erp-border)", background: "var(--erp-surface)" }}>
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

              const cd = venta.casheaDatos;
              let totalPagadoBs = 0;
              let totalPagadoUsd = 0;
              for (const pago of venta.pagos) {
                if (METODOS_PAGO_USD.includes(pago.metodo)) {
                  totalPagadoUsd += pago.monto;
                } else {
                  totalPagadoBs += pago.monto;
                }
              }
              const totalPagadoEnBs = cd
                ? usdToBs(cd.montoInicial, venta.tasaDelDia)
                : totalPagadoBs + usdToBs(totalPagadoUsd, venta.tasaDelDia);
              const totalPagadoEnUsd = cd
                ? cd.montoInicial
                : totalPagadoUsd + bsToUsd(totalPagadoBs, venta.tasaDelDia);

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
                      <span className="rounded-md px-2 py-1 font-bold text-white" style={{ background: "var(--erp-primary)" }}>
                        {venta.modoEntrega === "DELIVERY" ? "Delivery" : "Local"}
                      </span>
                    ) : venta.modoEntrega === "DELIVERY" ? (
                      "Delivery"
                    ) : (
                      "Local"
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {cd && (
                        cd.liquidado ? (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-bold text-black">C</span>
                            Liquidado
                          </span>
                        ) : casheaConfirm?.ventaId === venta.id ? (
                          <div className="flex flex-col gap-1.5 rounded-md border border-green-200 bg-green-50 p-2 text-left min-w-[180px]">
                            <div className="flex items-center gap-1 text-xs font-medium text-yellow-800">
                              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-bold text-black">C</span>
                              ${cd.montoFinanciado.toFixed(2)} financiado
                            </div>
                            <label className="text-xs text-zinc-500">Tasa del día (Bs/USD)</label>
                            <input
                              type="number"
                              step="0.0001"
                              min="0"
                              autoFocus
                              value={casheaConfirm.tasa}
                              onChange={(e) => setCasheaConfirm((c) => c ? { ...c, tasa: e.target.value } : c)}
                              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                            />
                            {Number(casheaConfirm.tasa) > 0 && (
                              <p className="text-xs font-medium text-zinc-700">
                                = Bs {(cd.montoFinanciado * Number(casheaConfirm.tasa)).toFixed(2)}
                              </p>
                            )}
                            <label className="text-xs text-zinc-500">¿Cuándo entró el dinero?</label>
                            <input
                              type="date"
                              max={today()}
                              value={casheaConfirm.fechaPago}
                              onChange={(e) => setCasheaConfirm((c) => c ? { ...c, fechaPago: e.target.value } : c)}
                              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleLiquidarCashea(venta.id, casheaConfirm.fechaPago)}
                                disabled={casheaUpdating === venta.id || !casheaConfirm.tasa || Number(casheaConfirm.tasa) <= 0}
                                className="flex-1 rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800 disabled:opacity-50"
                              >
                                {casheaUpdating === venta.id ? "..." : "Confirmar"}
                              </button>
                              <button
                                onClick={() => setCasheaConfirm(null)}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-yellow-400 text-[8px] font-bold text-black">C</span>
                              ${cd.montoFinanciado.toFixed(2)} pendiente
                            </span>
                            <button
                              onClick={() => setCasheaConfirm({ ventaId: venta.id, tasa: String(venta.tasaDelDia), fechaPago: today() })}
                              className="rounded-md border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100"
                            >
                              Marcar Pagada
                            </button>
                          </div>
                        )
                      )}
                      {venta.yummyDatos && (
                        <div className="flex flex-col items-center gap-1">
                          {!venta.yummyDatos.liquidado && yummyConfirmId === venta.id ? (
                            <FechaPagoConfirm
                              confirming={casheaUpdating === venta.id}
                              onConfirm={(fechaPago) => handleLiquidarYummy(venta.id, true, fechaPago)}
                              onCancel={() => setYummyConfirmId(null)}
                            />
                          ) : (
                            <>
                              <YummyToggle
                                checked={venta.yummyDatos.liquidado}
                                disabled={casheaUpdating === venta.id}
                                onToggle={() =>
                                  venta.yummyDatos!.liquidado
                                    ? handleLiquidarYummy(venta.id, false)
                                    : setYummyConfirmId(venta.id)
                                }
                              />
                              <span className="text-xs font-medium" style={{ color: venta.yummyDatos.liquidado ? "#15803d" : "#007e33" }}>
                                ${venta.yummyDatos.monto.toFixed(2)} {venta.yummyDatos.liquidado ? "cobrado" : "pendiente"}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                      {venta.cuentaPorCobrar && (
                        <>
                          {venta.cuentaCobrada ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Pagada</span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">Pendiente</span>
                          )}
                          <button
                            onClick={() => handleToggleCuentaCobrada(venta)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100"
                          >
                            {venta.cuentaCobrada ? "Marcar pendiente" : "Marcar pagada"}
                          </button>
                        </>
                      )}
                      {!cd && !venta.yummyDatos && !venta.cuentaPorCobrar && "-"}
                    </div>
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

      {/* ── Modal apertura de empaque ── */}
      {modalEmpaque && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--erp-surface)", border: "1px solid var(--erp-border)", borderRadius: 12, maxWidth: 440, width: "100%", overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,.2)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--erp-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📦</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--erp-text)" }}>Sin stock — empaque disponible</div>
                <div style={{ fontSize: 12, color: "var(--erp-text-2)" }}>¿Abrir un empaque para continuar la venta?</div>
              </div>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ background: "#FEE2E2", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 13 }}>
                <strong style={{ color: "#DC2626" }}>{modalEmpaque.producto.nombre}</strong>
                <span style={{ color: "#991B1B", marginLeft: 8 }}>Sin stock disponible</span>
              </div>

              {modalEmpaque.empaques.length === 1 ? (
                <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "10px 12px", fontSize: 13 }}>
                  <div style={{ fontWeight: 700, color: "#92400E" }}>📦 {modalEmpaque.empaques[0].empaqueNombre}</div>
                  <div style={{ color: "#78350F", marginTop: 2 }}>Stock: {modalEmpaque.empaques[0].empaqueStock} · Rinde {modalEmpaque.empaques[0].rendimiento} unidades al abrir</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {modalEmpaque.empaques.map((emp) => (
                    <label key={emp.id} style={{ display: "flex", gap: 10, alignItems: "center", background: modalEmpaque.seleccionado === emp.id ? "#DBEAFE" : "var(--erp-bg)", border: `2px solid ${modalEmpaque.seleccionado === emp.id ? "var(--erp-primary)" : "var(--erp-border)"}`, borderRadius: 6, padding: "9px 12px", cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" name="empaque-sel" checked={modalEmpaque.seleccionado === emp.id} onChange={() => setModalEmpaque(prev => prev ? { ...prev, seleccionado: emp.id } : null)} />
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--erp-text)" }}>{emp.empaqueNombre} <span style={{ fontWeight: 400, color: "var(--erp-text-3)" }}>({emp.prioridad === 1 ? "Principal" : "Alternativo"})</span></div>
                        <div style={{ color: "var(--erp-text-2)", fontSize: 12 }}>Stock: {emp.empaqueStock} · Rinde {emp.rendimiento} unidades</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {modalEmpaque.seleccionado && (() => {
                const sel = modalEmpaque.empaques.find(e => e.id === modalEmpaque.seleccionado);
                if (!sel) return null;
                return (
                  <div style={{ marginTop: 10, background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 6, padding: "10px 12px", fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: "#15803D", marginBottom: 4 }}>✓ Resultado si confirma</div>
                    <div style={{ color: "#166534", display: "flex", flexDirection: "column", gap: 2 }}>
                      <span>📦 {sel.empaqueNombre}: −1 (quedan {sel.empaqueStock - 1})</span>
                      <span>➕ {sel.rendimiento} unidades generadas</span>
                      <span>🛒 −1 unidad vendida al pedido</span>
                      <span style={{ borderTop: "1px solid #86EFAC", paddingTop: 4, marginTop: 2, fontWeight: 700 }}>✓ Quedan {sel.rendimiento - 1} en inventario</span>
                    </div>
                  </div>
                );
              })()}

              {modalEmpaque.error && (
                <div style={{ marginTop: 8, background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#DC2626" }}>{modalEmpaque.error}</div>
              )}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--erp-border)", display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  // Quitar el producto del ítem para no permitir la venta sin abrir empaque
                  if (modalEmpaque) {
                    updateItem(modalEmpaque.itemIndex, { productoId: "", extraId: "", cantidad: "1", variadaSelecciones: [] });
                  }
                  setModalEmpaque(null);
                }}
                style={{ background: "transparent", border: "1px solid var(--erp-border)", borderRadius: 6, padding: "8px 16px", fontSize: 13, color: "var(--erp-text-2)", cursor: "pointer" }}
              >Cancelar</button>
              <button
                type="button"
                onClick={handleAbrirEmpaque}
                disabled={!modalEmpaque.seleccionado || modalEmpaque.abriendo}
                style={{ flex: 1, background: "var(--erp-primary)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: modalEmpaque.abriendo ? 0.6 : 1 }}
              >{modalEmpaque.abriendo ? "Abriendo empaque…" : "✓ Abrir empaque y vender"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

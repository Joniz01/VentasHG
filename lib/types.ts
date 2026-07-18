export const ROLES = ["ADMIN", "USUARIO"] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_LABELS: Record<Rol, string> = {
  ADMIN: "Administrador",
  USUARIO: "Usuario del sistema",
};

export const PERMISO_TABS = [
  { key: "productos", label: "Productos" },
  { key: "ventas", label: "Ventas" },
  { key: "reportes", label: "Reportes" },
  { key: "pedidosPendientes", label: "Pedidos Pendientes" },
  { key: "descuento", label: "Aplicar Descuento" },
  { key: "dashboard", label: "Dashboard Consolidado" },
  { key: "compras", label: "Compras" },
  { key: "eliminarCompras", label: "Eliminar Facturas Anuladas" },
  { key: "gastos", label: "Nómina & Gastos" },
] as const;

export type PermisoTab = (typeof PERMISO_TABS)[number]["key"];

export type PermisosUsuario = Record<PermisoTab, boolean>;

export const PERMISOS_VACIOS: PermisosUsuario = {
  productos: false,
  ventas: false,
  reportes: false,
  pedidosPendientes: false,
  descuento: false,
  dashboard: false,
  compras: false,
  eliminarCompras: false,
  gastos: false,
};

export type Usuario = {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
  activo: boolean;
  permisos: PermisosUsuario;
};

export type UsuarioInput = {
  nombre: string;
  usuario: string;
  clave: string;
  rol: Rol;
  permisos: PermisosUsuario;
};

export type Motorizado = {
  id: number;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  usuario: string;
  activo: boolean;
};

export type MotorizadoInput = {
  nombre: string;
  apellido: string;
  telefono: string;
  usuario: string;
  clave: string;
};

export type Categoria = {
  id: number;
  nombre: string;
};

export type Cliente = {
  id: number;
  nombre: string;
  cedula: string | null;
  direccion: string | null;
  telefono: string | null;
};

export type ClienteInput = {
  nombre: string;
  cedula: string;
  direccion: string;
  telefono: string;
};

export type ClientesConfig = {
  cedulaObligatoria: boolean;
  telefonoObligatorio: boolean;
  direccionObligatoria: boolean;
};

export const CLIENTES_CONFIG_DEFAULT: ClientesConfig = {
  cedulaObligatoria: false,
  telefonoObligatorio: false,
  direccionObligatoria: false,
};

export type ExtraCatalogo = {
  id: number;
  nombre: string;
  precios: number[];
};

export type ProductoExtra = {
  id: number;
  productoId: number;
  extraId: number;
  nombre: string;
  precioAdicional: number;
};

export const TIPOS_PRODUCTO = ["NORMAL", "COMBO", "VARIADA"] as const;
export type TipoProducto = (typeof TIPOS_PRODUCTO)[number];

export const TIPO_PRODUCTO_LABELS: Record<TipoProducto, string> = {
  NORMAL: "Normal (con inventario)",
  COMBO: "Combo / Pack (descuenta componentes)",
  VARIADA: "Bandeja Variada (raciones a elegir)",
};

export type ProductoComponente = {
  id: number;
  productoId: number;
  componenteId: number;
  componenteNombre: string;
  cantidad: number;
};

export const TIPOS_MOVIMIENTO_INVENTARIO = ["ENTRADA", "AJUSTE", "VENTA"] as const;
export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO_INVENTARIO)[number];

export type MovimientoInventario = {
  id: number;
  productoId: number;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  nota: string | null;
  ventaId: number | null;
  createdAt: string;
};

export type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  costo: number;
  precioVenta: number;
  activo: boolean;
  categoriaId: number | null;
  categoriaNombre: string | null;
  tipoProducto: TipoProducto;
  stockActual: number;
  variadaRaciones: number;
  createdAt: string;
  extras: ProductoExtra[];
  componentes: ProductoComponente[];
};

export const METODOS_PAGO = [
  "PUNTO_VENTA",
  "TRANSFERENCIA",
  "PAGO_MOVIL",
  "EFECTIVO_BS",
  "EFECTIVO_USD",
  "ZELLE",
  "CASHEA",
  "YUMMY",
] as const;

export type MetodoPago = (typeof METODOS_PAGO)[number];

// Métodos de pago cuyo monto se ingresa directamente en dólares
export const METODOS_PAGO_USD: readonly MetodoPago[] = ["EFECTIVO_USD", "ZELLE"];

export const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
  PUNTO_VENTA: "Punto de Venta",
  TRANSFERENCIA: "Transferencia",
  PAGO_MOVIL: "Pago Móvil",
  EFECTIVO_BS: "Efectivo Bolívares",
  EFECTIVO_USD: "Efectivo Dólares",
  ZELLE: "Zelle",
  CASHEA: "Cashea",
  YUMMY: "Yummy",
};

export type CasheaPagoItem = {
  ventaId: number;
  fecha: string;
  cliente: string;
  porcentaje: number;
  montoInicial: number;
  montoFinanciado: number;
  dias: number;
  fechaVencimiento: string;
  liquidado: boolean;
  liquidadoAt: string | null;
  alarmaSilenciadaHasta: string | null;
  tasaDelDia: number;
  metodoInicial: string | null;
};

export type YummyPagoItem = {
  ventaId: number;
  fecha: string;
  cliente: string;
  monto: number;
  dias: number;
  fechaVencimiento: string;
  liquidado: boolean;
  liquidadoAt: string | null;
};

export const MODOS_ENTREGA = ["LOCAL", "DELIVERY", "PICK_UP"] as const;

export type ModoEntrega = (typeof MODOS_ENTREGA)[number];

export type VariadaSeleccion = {
  productoId: number;
  nombreProducto: string;
  cantidad: number;
};

export type VentaItem = {
  id: number;
  productoId: number;
  nombreProducto: string;
  cantidad: number;
  costoUnit: number;
  precioUnit: number;
  extraId: number | null;
  extraNombre: string | null;
  extraPrecio: number;
  variadaSelecciones?: VariadaSeleccion[];
};

export type PagoVenta = {
  id: number;
  metodo: MetodoPago;
  monto: number;
};

export const TIPOS_DELIVERY = ["EMPRESA", "WINK", "YUMMY"] as const;
export type TipoDelivery = (typeof TIPOS_DELIVERY)[number];

export const TIPO_DELIVERY_LABELS: Record<TipoDelivery, string> = {
  EMPRESA: "Motorizado de la Empresa",
  WINK: "Wink",
  YUMMY: "Yummy",
};

export type Venta = {
  id: number;
  fecha: string;
  tasaDelDia: number;
  cliente: string;
  clienteCi: string | null;
  clienteTelefono: string | null;
  direccion: string | null;
  modalidadCompra: string | null;
  modoEntrega: ModoEntrega;
  tipoDelivery: TipoDelivery | null;
  costoDelivery: number;
  descuentoPorcentaje: number;
  observaciones: string | null;
  despachoPendiente: boolean;
  horaEntrega: string | null;
  horaPreparacion: string | null;
  horaRetiro: string | null;
  deliveryAsignado: string | null;
  motorizadoId: number | null;
  pedidoEntregado: boolean;
  pedidoEnviado: boolean;
  cuentaPorCobrar: boolean;
  fechaLimitePago: string | null;
  cuentaCobrada: boolean;
  cuentaCobradaAt: string | null;
  createdAt: string;
  items: VentaItem[];
  pagos: PagoVenta[];
  casheaDatos: {
    porcentaje: number;
    montoInicial: number;
    montoFinanciado: number;
    dias: number;
    fechaVencimiento: string;
    liquidado: boolean;
    liquidadoAt: string | null;
    metodoInicial: string | null;
  } | null;
  yummyDatos: {
    monto: number;
    dias: number;
    fechaVencimiento: string;
    liquidado: boolean;
    liquidadoAt: string | null;
  } | null;
};

export type VentaItemInput = {
  productoId: number;
  cantidad: number;
  extraId?: number | null;
  variadaSelecciones?: number[];
};

export type PagoVentaInput = {
  metodo: MetodoPago;
  monto: number;
};

export type VentaInput = {
  fecha: string;
  tasaDelDia: number;
  cliente: string;
  clienteCi: string;
  clienteTelefono: string;
  direccion: string;
  modalidadCompra: string;
  modoEntrega: ModoEntrega;
  costoDelivery: number;
  observaciones: string;
  despachoPendiente: boolean;
  horaEntrega: string | null;
  horaPreparacion: string | null;
  horaRetiro: string | null;
  deliveryAsignado: string;
  motorizadoId: number | null;
  items: VentaItemInput[];
  pagos: PagoVentaInput[];
};

export type PedidoPendienteItem = {
  nombreProducto: string;
  cantidad: number;
  extraNombre: string | null;
};

export type PedidoPendiente = {
  id: number;
  fecha: string;
  cliente: string;
  direccion: string | null;
  deliveryAsignado: string | null;
  motorizadoId: number | null;
  fritoCongelado: string;
  horaEntrega: string;
  horaPreparacion: string;
  horaRetiro: string | null;
  pedidoAceptado: boolean;
  pedidoEntregado: boolean;
  pedidoEnviado: boolean;
  items: PedidoPendienteItem[];
};

export const TIPOS_ALARMA = ["navegador", "tono", "mp3", "voz"] as const;
export type TipoAlarma = (typeof TIPOS_ALARMA)[number];

export const TONOS_PRESET = ["clasico", "campana", "urgente", "suave"] as const;
export type TonoPreset = (typeof TONOS_PRESET)[number];

export type AlarmaEtapaConfig = {
  tipo: TipoAlarma;
  tonoId: TonoPreset;
  audioDataUrl: string | null;
  audioNombre: string | null;
  mensajeVoz: string;
  repetirSegundos: number;
  silenciarMinutos: number;
};

export type AlarmasConfig = {
  preparacion: AlarmaEtapaConfig;
  retiro: AlarmaEtapaConfig;
  entrega: AlarmaEtapaConfig;
  vencimientoHora: string;
  casheaVencimientoHora: string;
};

export const ALARMA_ETAPA_DEFAULT: AlarmaEtapaConfig = {
  tipo: "navegador",
  tonoId: "clasico",
  audioDataUrl: null,
  audioNombre: null,
  mensajeVoz: "",
  repetirSegundos: 30,
  silenciarMinutos: 5,
};

export const ALARMAS_CONFIG_DEFAULT: AlarmasConfig = {
  preparacion: { ...ALARMA_ETAPA_DEFAULT },
  retiro: { ...ALARMA_ETAPA_DEFAULT },
  entrega: { ...ALARMA_ETAPA_DEFAULT },
  vencimientoHora: "09:00",
  casheaVencimientoHora: "09:00",
};

export type ReporteFormaPago = {
  metodo: MetodoPago;
  totalUsd: number;
  totalBs: number;
};

export type ReporteCliente = {
  cliente: string;
  clienteCi: string | null;
  cantidadVentas: number;
  totalUsd: number;
};

export type ReporteProducto = {
  productoId: number;
  nombre: string;
  cantidad: number;
  totalUsd: number;
  margenUsd: number;
};

export type ReporteVentas = {
  desde: string;
  hasta: string;
  totalVentasUsd: number;
  cantidadVentas: number;
  porFormaPago: ReporteFormaPago[];
  porCliente: ReporteCliente[];
  porProducto: ReporteProducto[];
};

export type ReporteDeliveryItem = {
  ventaId: number;
  cliente: string;
  fecha: string;
  costoDeliveryUsd: number;
  costoDeliveryBs: number;
  deliveryPagado: boolean;
};

export type ReporteDeliveryMotorizado = {
  desde: string;
  hasta: string;
  items: ReporteDeliveryItem[];
  totalUsd: number;
  totalBs: number;
};

export type DeliveryPagoItem = {
  ventaId: number;
  fecha: string;
  cliente: string;
  clienteCi: string | null;
  deliveryAsignado: string | null;
  motorizadoId: number | null;
  motorizadoNombre: string | null;
  costoDeliveryUsd: number;
  costoDeliveryBs: number;
  deliveryPagado: boolean;
  deliveryPagadoAt: string | null;
};

export type CuentaPorCobrarItem = {
  ventaId: number;
  fecha: string;
  cliente: string;
  clienteCi: string | null;
  clienteTelefono: string | null;
  totalUsd: number;
  totalBs: number;
  fechaLimitePago: string | null;
  cuentaCobrada: boolean;
  cuentaCobradaAt: string | null;
  alarmaSilenciadaHasta: string | null;
  tipoCxC: "CASHEA" | "YUMMY" | "CxC Directa";
};

export type VentaPendientePago = {
  id: number;
  cliente: string;
  clienteCi: string | null;
  clienteTelefono: string | null;
  direccion: string | null;
  fechaLimitePago: string | null;
  items: {
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
  }[];
};

export type Locacion = {
  id: number;
  nombre: string;
  activo: boolean;
};

export type TipoGastoCatalogo = {
  id: number;
  nombre: string;
  activo: boolean;
};

export const TIPOS_GASTO = ["FIJO", "OCASIONAL"] as const;
export type TipoGasto = (typeof TIPOS_GASTO)[number];

export const ESTADOS_GASTO = ["PENDIENTE", "APROBADO", "PAGADO"] as const;
export type EstadoGasto = (typeof ESTADOS_GASTO)[number];

export const ESTADO_GASTO_LABELS: Record<EstadoGasto, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  PAGADO: "Pagado",
};

export const FRECUENCIAS_RECURRENCIA = ["SEMANAL", "QUINCENAL", "MENSUAL"] as const;
export type FrecuenciaRecurrencia = (typeof FRECUENCIAS_RECURRENCIA)[number];

export const FRECUENCIA_RECURRENCIA_LABELS: Record<FrecuenciaRecurrencia, string> = {
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual",
};

export type Gasto = {
  id: number;
  tipoGastoId: number;
  tipoGastoNombre: string;
  tipo: TipoGasto;
  proveedor: string;
  descripcion: string | null;
  locacionId: number | null;
  locacionNombre: string | null;
  fecha: string;
  montoBs: number;
  tasaDia: number;
  montoUsd: number;
  estado: EstadoGasto;
  pagadoAt: string | null;
  comprobanteUrl: string | null;
  recurrente: boolean;
  frecuencia: FrecuenciaRecurrencia | null;
  proximoRecordatorio: string | null;
  recordatorioVisto: boolean;
  createdAt: string;
};

export type GastoInput = {
  tipoGastoId: number;
  tipo: TipoGasto;
  proveedor: string;
  descripcion: string;
  locacionId: number | null;
  fecha: string;
  montoBs: number;
  tasaDia: number;
  estado: EstadoGasto;
  comprobanteUrl: string;
  recurrente: boolean;
  frecuencia: FrecuenciaRecurrencia | null;
};

export type GastoResumen = {
  gastoHoy: number;
  gastoMes: number;
  pendientePorPagar: number;
};

export const SEXOS = ["MASCULINO", "FEMENINO"] as const;
export type Sexo = (typeof SEXOS)[number];

export const SEXO_LABELS: Record<Sexo, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
};

export type Empleado = {
  id: number;
  nombre: string;
  cedula: string | null;
  fechaNacimiento: string | null;
  sexo: Sexo | null;
  cargo: string | null;
  locacionId: number | null;
  locacionNombre: string | null;
  tipoPago: FrecuenciaRecurrencia;
  salarioBaseUsd: number;
  salarioBaseBs: number;
  tasaRegistro: number;
  fechaIngreso: string | null;
  activo: boolean;
  createdAt: string;
};

export type EmpleadoInput = {
  nombre: string;
  cedula: string;
  fechaNacimiento: string;
  sexo: Sexo | null;
  cargo: string;
  locacionId: number | null;
  tipoPago: FrecuenciaRecurrencia;
  salarioBaseUsd: number;
  salarioBaseBs: number;
  tasaRegistro: number;
  fechaIngreso: string;
  activo: boolean;
};

export type TipoIncidencia = {
  id: number;
  nombre: string;
  activo: boolean;
};

export const ESTADOS_NOMINA_PAGO = ["PENDIENTE", "PAGADO"] as const;
export type EstadoNominaPago = (typeof ESTADOS_NOMINA_PAGO)[number];

export const ESTADO_NOMINA_PAGO_LABELS: Record<EstadoNominaPago, string> = {
  PENDIENTE: "Pendiente",
  PAGADO: "Pagado",
};

export const ESTADOS_PERIODO_NOMINA = ["ABIERTO", "CERRADO"] as const;
export type EstadoPeriodoNomina = (typeof ESTADOS_PERIODO_NOMINA)[number];

export type NominaIncidencia = {
  id: number;
  tipoIncidenciaId: number;
  tipoIncidenciaNombre: string;
  montoBs: number;
};

export type NominaPago = {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  salarioBaseBs: number;
  incidencias: NominaIncidencia[];
  totalIncidenciasBs: number;
  totalBs: number;
  totalUsd: number;
  estado: EstadoNominaPago;
  pagadoAt: string | null;
};

export type PeriodoNomina = {
  id: number;
  frecuencia: FrecuenciaRecurrencia;
  fechaDesde: string;
  fechaHasta: string;
  tasaDia: number;
  estado: EstadoPeriodoNomina;
  pagos: NominaPago[];
  totalGeneralBs: number;
  totalGeneralUsd: number;
  createdAt: string;
};

export type PeriodoNominaInput = {
  frecuencia: FrecuenciaRecurrencia;
  fechaDesde: string;
  fechaHasta: string;
  tasaDia: number;
};

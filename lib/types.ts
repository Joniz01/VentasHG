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

export const MODOS_ENTREGA = ["LOCAL", "DELIVERY"] as const;

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

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
] as const;

export type PermisoTab = (typeof PERMISO_TABS)[number]["key"];

export type PermisosUsuario = Record<PermisoTab, boolean>;

export const PERMISOS_VACIOS: PermisosUsuario = {
  productos: false,
  ventas: false,
  reportes: false,
  pedidosPendientes: false,
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

export type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  costo: number;
  precioVenta: number;
  activo: boolean;
  categoriaId: number | null;
  categoriaNombre: string | null;
  createdAt: string;
  extras: ProductoExtra[];
};

export const METODOS_PAGO = [
  "PUNTO_VENTA",
  "TRANSFERENCIA",
  "PAGO_MOVIL",
  "EFECTIVO_BS",
  "EFECTIVO_USD",
  "ZELLE",
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
};

export const MODOS_ENTREGA = ["LOCAL", "DELIVERY"] as const;

export type ModoEntrega = (typeof MODOS_ENTREGA)[number];

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
};

export type PagoVenta = {
  id: number;
  metodo: MetodoPago;
  monto: number;
};

export type Venta = {
  id: number;
  fecha: string;
  tasaDelDia: number;
  cliente: string;
  clienteCi: string | null;
  direccion: string | null;
  modalidadCompra: string | null;
  modoEntrega: ModoEntrega;
  costoDelivery: number;
  observaciones: string | null;
  despachoPendiente: boolean;
  horaEntrega: string | null;
  horaPreparacion: string | null;
  deliveryAsignado: string | null;
  motorizadoId: number | null;
  pedidoEntregado: boolean;
  pedidoEnviado: boolean;
  createdAt: string;
  items: VentaItem[];
  pagos: PagoVenta[];
};

export type VentaItemInput = {
  productoId: number;
  cantidad: number;
  extraId?: number | null;
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
  direccion: string;
  modalidadCompra: string;
  modoEntrega: ModoEntrega;
  costoDelivery: number;
  observaciones: string;
  despachoPendiente: boolean;
  horaEntrega: string | null;
  horaPreparacion: string | null;
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
  cliente: string;
  direccion: string | null;
  deliveryAsignado: string | null;
  motorizadoId: number | null;
  fritoCongelado: string;
  horaEntrega: string;
  horaPreparacion: string;
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
  entrega: AlarmaEtapaConfig;
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
  entrega: { ...ALARMA_ETAPA_DEFAULT },
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
};

export type ReporteDeliveryMotorizado = {
  desde: string;
  hasta: string;
  items: ReporteDeliveryItem[];
  totalUsd: number;
  totalBs: number;
};

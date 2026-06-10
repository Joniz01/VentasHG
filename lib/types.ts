export type Categoria = {
  id: number;
  nombre: string;
};

export type ExtraCatalogo = {
  id: number;
  nombre: string;
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
  modalidadCompra: string | null;
  modoEntrega: ModoEntrega;
  costoDelivery: number;
  observaciones: string | null;
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
  modalidadCompra: string;
  modoEntrega: ModoEntrega;
  costoDelivery: number;
  observaciones: string;
  items: VentaItemInput[];
  pagos: PagoVentaInput[];
};

export type EstadoPedido = "PENDIENTE" | "PREPARAR" | "ENVIADO" | "ENTREGAR";

export function computeEstadoPedido(
  now: number,
  horaPreparacion: string,
  horaEntrega: string,
  pedidoEnviado: boolean
): EstadoPedido {
  const prep = new Date(horaPreparacion).getTime();
  const entrega = new Date(horaEntrega).getTime();
  if (now >= entrega) return "ENTREGAR";
  if (pedidoEnviado) return "ENVIADO";
  if (now >= prep) return "PREPARAR";
  return "PENDIENTE";
}

export const ESTADO_PEDIDO_LABELS: Record<EstadoPedido, string> = {
  PENDIENTE: "Pendiente",
  PREPARAR: "Por preparar",
  ENVIADO: "Enviado",
  ENTREGAR: "Por entregar",
};

export const ESTADO_PEDIDO_CLASES: Record<EstadoPedido, string> = {
  PENDIENTE: "border-zinc-200 bg-white",
  PREPARAR: "border-yellow-300 bg-yellow-100",
  ENVIADO: "border-blue-300 bg-blue-100",
  ENTREGAR: "border-pink-200 bg-pink-100",
};

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatHora(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Las fechas (sin hora) llegan como "YYYY-MM-DD" o "YYYY-MM-DDT00:00:00.000Z".
// Se formatean a partir del string para evitar que la conversión a la
// zona horaria local desplace el día (ej: medianoche UTC -> día anterior).
export function formatFecha(fecha: string): string {
  const [year, month, day] = fecha.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

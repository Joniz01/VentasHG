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

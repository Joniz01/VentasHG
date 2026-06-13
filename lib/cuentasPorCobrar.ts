import type { CuentaPorCobrarItem } from "@/lib/types";

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function esCuentaVencida(item: CuentaPorCobrarItem, now: number): boolean {
  if (item.cuentaCobrada || !item.fechaLimitePago) return false;
  return item.fechaLimitePago <= toIsoDate(new Date(now));
}

export function alarmaVencimientoActiva(
  item: CuentaPorCobrarItem,
  now: number,
  vencimientoHora: string
): boolean {
  if (!esCuentaVencida(item, now)) return false;

  if (item.alarmaSilenciadaHasta && now < new Date(item.alarmaSilenciadaHasta).getTime()) {
    return false;
  }

  const [horas, minutos] = vencimientoHora.split(":").map(Number);
  const horaAlertaHoy = new Date(now);
  horaAlertaHoy.setHours(horas, minutos, 0, 0);

  return now >= horaAlertaHoy.getTime();
}

export function proximaAlarmaVencimiento(vencimientoHora: string): string {
  const [horas, minutos] = vencimientoHora.split(":").map(Number);
  const proximo = new Date();
  proximo.setDate(proximo.getDate() + 1);
  proximo.setHours(horas, minutos, 0, 0);
  return proximo.toISOString();
}

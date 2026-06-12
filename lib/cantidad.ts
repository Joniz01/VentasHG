/**
 * Cuando el usuario usa las flechitas de un input numérico cuyo valor actual
 * tiene decimales, el navegador suma/resta el step preservando los decimales
 * (ej: 1,04 + 1 = 2,04). Esta función detecta ese caso y redondea al entero
 * más cercano antes de aplicar el incremento/decremento.
 */
export function ajustarCantidadConFlechas(
  valorAnterior: string,
  valorNuevo: string,
  step = 1
): string {
  const anterior = Number(valorAnterior.replace(",", "."));
  const nuevo = Number(valorNuevo.replace(",", "."));

  if (Number.isNaN(anterior) || Number.isNaN(nuevo)) {
    return valorNuevo;
  }

  const diferencia = nuevo - anterior;
  if (Math.abs(Math.abs(diferencia) - step) < 1e-9) {
    const base = Math.round(anterior);
    const ajustado = diferencia > 0 ? base + step : base - step;
    return String(ajustado);
  }

  return valorNuevo;
}

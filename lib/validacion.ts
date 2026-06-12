// Valida el campo C.I/Rif: una cédula es solo números, un Rif inicia con V/J/G
// (con o sin guion) seguido de números. El campo es opcional.
export function validarCedulaRif(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d+$/.test(v)) return null;
  if (/^[VJGvjg]-?\d+$/.test(v)) return null;

  return "C.I/Rif inválido: debe ser solo números (cédula) o iniciar con V, J o G seguido de números (Rif)";
}

import { DESCUENTO_TIPOS, type PromocionInput } from "@/lib/types";

export function mapPromocion(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    descuentoTipo: r.descuento_tipo,
    valorPorcentaje: r.valor_porcentaje != null ? Number(r.valor_porcentaje) : null,
    precioFijoUsd: r.precio_fijo_usd != null ? Number(r.precio_fijo_usd) : null,
    tieneProductoGratis: r.tiene_producto_gratis,
    productoGratisId: r.producto_gratis_id,
    productoGratisNombre: r.producto_gratis_nombre,
    cantidadGratis: r.cantidad_gratis != null ? Number(r.cantidad_gratis) : null,
    fechaInicio: r.fecha_inicio ? String(r.fecha_inicio).slice(0, 10) : null,
    fechaFin: r.fecha_fin ? String(r.fecha_fin).slice(0, 10) : null,
    activa: r.activa,
    createdAt: r.created_at,
  };
}

// Valida el cuerpo de la promoción devolviendo, además del mensaje, los
// campos exactos que faltan/están mal para poder resaltarlos en el formulario.
export function validarPromocion(body: PromocionInput): { error: string; campos: string[] } | null {
  const campos: string[] = [];

  if (!body.nombre?.trim()) campos.push("nombre");
  if (!body.productoId) campos.push("productoId");
  if (!body.fechaInicio) campos.push("fechaInicio");

  if (body.descuentoTipo && !DESCUENTO_TIPOS.includes(body.descuentoTipo)) {
    return { error: "Tipo de descuento inválido", campos: ["descuentoTipo"] };
  }
  if (body.descuentoTipo === "PORCENTAJE" && !(Number(body.valorPorcentaje) > 0)) {
    campos.push("valorPorcentaje");
  }
  if (body.descuentoTipo === "PRECIO_FIJO" && !(Number(body.precioFijoUsd) > 0)) {
    campos.push("precioFijoUsd");
  }
  if (body.tieneProductoGratis && !body.productoGratisId) {
    campos.push("productoGratisId");
  }
  if (!body.descuentoTipo && !body.tieneProductoGratis) {
    campos.push("descuentoTipo", "tieneProductoGratis");
  }

  if (campos.length === 0) return null;
  return { error: "Completa los campos resaltados para guardar la promoción", campos };
}

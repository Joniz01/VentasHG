import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import { TIPOS_PROMOCION, type PromocionInput } from "@/lib/types";

function mapPromocion(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    productoId: r.producto_id,
    productoNombre: r.producto_nombre,
    valorPorcentaje: r.valor_porcentaje != null ? Number(r.valor_porcentaje) : null,
    precioFijoUsd: r.precio_fijo_usd != null ? Number(r.precio_fijo_usd) : null,
    productoGratisId: r.producto_gratis_id,
    productoGratisNombre: r.producto_gratis_nombre,
    cantidadGratis: r.cantidad_gratis != null ? Number(r.cantidad_gratis) : null,
    fechaInicio: r.fecha_inicio ? String(r.fecha_inicio).slice(0, 10) : null,
    fechaFin: r.fecha_fin ? String(r.fecha_fin).slice(0, 10) : null,
    activa: r.activa,
    createdAt: r.created_at,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const result = await pool.query(
      `SELECT p.*, prod.nombre AS producto_nombre, pg.nombre AS producto_gratis_nombre
       FROM promociones p
       JOIN productos prod ON prod.id = p.producto_id
       LEFT JOIN productos pg ON pg.id = p.producto_gratis_id
       ORDER BY p.activa DESC, p.created_at DESC`
    );
    return NextResponse.json(result.rows.map(mapPromocion));
  } catch {
    // Migración 061 pendiente de aplicar
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.promociones)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as PromocionInput;

  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "El nombre de la promoción es obligatorio" }, { status: 400 });
  }
  if (!TIPOS_PROMOCION.includes(body.tipo)) {
    return NextResponse.json({ error: "Tipo de promoción inválido" }, { status: 400 });
  }
  if (!body.productoId) {
    return NextResponse.json({ error: "Selecciona el producto en promoción" }, { status: 400 });
  }
  if (body.tipo === "DESCUENTO_PORCENTAJE" && !(Number(body.valorPorcentaje) > 0)) {
    return NextResponse.json({ error: "Indica el porcentaje de descuento" }, { status: 400 });
  }
  if (body.tipo === "PRECIO_FIJO" && !(Number(body.precioFijoUsd) > 0)) {
    return NextResponse.json({ error: "Indica el precio de venta fijo" }, { status: 400 });
  }
  if (body.tipo === "PRODUCTO_GRATIS" && !body.productoGratisId) {
    return NextResponse.json({ error: "Selecciona el producto adicional sin costo" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `INSERT INTO promociones
        (nombre, tipo, producto_id, valor_porcentaje, precio_fijo_usd, producto_gratis_id, cantidad_gratis, fecha_inicio, fecha_fin, activa, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        body.nombre.trim(),
        body.tipo,
        body.productoId,
        body.tipo === "DESCUENTO_PORCENTAJE" ? Number(body.valorPorcentaje) : null,
        body.tipo === "PRECIO_FIJO" ? Number(body.precioFijoUsd) : null,
        body.tipo === "PRODUCTO_GRATIS" ? body.productoGratisId : null,
        body.tipo === "PRODUCTO_GRATIS" ? Number(body.cantidadGratis) || 1 : null,
        body.fechaInicio || null,
        body.fechaFin || null,
        body.activa ?? true,
        sesion.id,
      ]
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al crear la promoción" }, { status: 400 });
  }
}

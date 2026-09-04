import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { PromocionInput } from "@/lib/types";
import { mapPromocion, validarPromocion } from "@/lib/promociones";

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
    // Migración 061/062 pendiente de aplicar
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.promociones)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as PromocionInput;

  const invalido = validarPromocion(body);
  if (invalido) return NextResponse.json(invalido, { status: 400 });

  try {
    const result = await pool.query(
      `INSERT INTO promociones
        (nombre, producto_id, descuento_tipo, valor_porcentaje, precio_fijo_usd,
         tiene_producto_gratis, producto_gratis_id, cantidad_gratis, fecha_inicio, fecha_fin, activa, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        body.nombre.trim(),
        body.productoId,
        body.descuentoTipo || null,
        body.descuentoTipo === "PORCENTAJE" ? Number(body.valorPorcentaje) : null,
        body.descuentoTipo === "PRECIO_FIJO" ? Number(body.precioFijoUsd) : null,
        Boolean(body.tieneProductoGratis),
        body.tieneProductoGratis ? body.productoGratisId : null,
        body.tieneProductoGratis ? Number(body.cantidadGratis) || 1 : null,
        body.fechaInicio,
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

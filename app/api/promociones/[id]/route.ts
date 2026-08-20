import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import { TIPOS_PROMOCION, type PromocionInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.promociones)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
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
      `UPDATE promociones
       SET nombre = $1, tipo = $2, producto_id = $3, valor_porcentaje = $4, precio_fijo_usd = $5,
           producto_gratis_id = $6, cantidad_gratis = $7, fecha_inicio = $8, fecha_fin = $9,
           activa = $10, updated_at = now()
       WHERE id = $11
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
        id,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ id: Number(id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al actualizar la promoción" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.promociones)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { activa?: boolean };

  if (typeof body.activa !== "boolean") {
    return NextResponse.json({ error: "activa es requerido" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE promociones SET activa = $1, updated_at = now() WHERE id = $2 RETURNING id`,
    [body.activa, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ id: Number(id), activa: body.activa });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.promociones)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(`DELETE FROM promociones WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Promoción no encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

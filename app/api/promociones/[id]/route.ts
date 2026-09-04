import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import type { PromocionInput } from "@/lib/types";
import { validarPromocion } from "@/lib/promociones";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.promociones)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as PromocionInput;

  const invalido = validarPromocion(body);
  if (invalido) return NextResponse.json(invalido, { status: 400 });

  try {
    const result = await pool.query(
      `UPDATE promociones
       SET nombre = $1, producto_id = $2, descuento_tipo = $3, valor_porcentaje = $4, precio_fijo_usd = $5,
           tiene_producto_gratis = $6, producto_gratis_id = $7, cantidad_gratis = $8,
           fecha_inicio = $9, fecha_fin = $10, activa = $11, updated_at = now()
       WHERE id = $12
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

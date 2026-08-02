import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { TIPOS_PRODUCTO } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const {
    nombre, descripcion, costo, precioVenta, activo, categoriaId, tipoProducto, variadaRaciones,
    stockMinimo, unidadMedida, alertaOutstockDesactivada, alertaOutstockMotivo, grupo,
  } = body;

  const costoNum = Number(costo);
  const precioNum = Number(precioVenta);

  if (!nombre || Number.isNaN(costoNum) || Number.isNaN(precioNum)) {
    return NextResponse.json(
      { error: "Datos inválidos" },
      { status: 400 }
    );
  }

  if (tipoProducto && !TIPOS_PRODUCTO.includes(tipoProducto)) {
    return NextResponse.json({ error: "Tipo de producto inválido" }, { status: 400 });
  }

  const categoriaIdNum = categoriaId ? Number(categoriaId) : null;
  const variadaRacionesNum = Number(variadaRaciones) || 0;
  const stockMinimoNum = Math.max(0, Number(stockMinimo) || 0);
  const unidadMedidaStr = typeof unidadMedida === "string" && unidadMedida.trim() ? unidadMedida.trim() : "unidad";
  const outstockBool = Boolean(alertaOutstockDesactivada);
  const outstockMotivo = typeof alertaOutstockMotivo === "string" && alertaOutstockMotivo.trim() ? alertaOutstockMotivo.trim() : null;
  const grupoStr = ["PARA_LA_VENTA", "MATERIA_PRIMA", "SERVICIO"].includes(grupo) ? grupo : "PARA_LA_VENTA";

  // Try with new columns first; fall back gracefully if migration 046 hasn't run yet
  let result;
  try {
    result = await pool.query(
      `UPDATE productos
       SET nombre = $1, descripcion = $2, costo = $3, precio_venta = $4, activo = $5, categoria_id = $6,
           tipo_producto = $7, variada_raciones = $8,
           stock_minimo = $9, unidad_medida = $10,
           alerta_outstock_desactivada = $11, alerta_outstock_motivo = $12,
           grupo = $13
       WHERE id = $14
       RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, created_at,
                 tipo_producto, stock_actual, variada_raciones,
                 stock_minimo, unidad_medida, alerta_outstock_desactivada, alerta_outstock_motivo,
                 COALESCE(grupo, 'PARA_LA_VENTA') AS grupo`,
      [nombre, descripcion ?? null, costoNum, precioNum, activo ?? true, categoriaIdNum,
       tipoProducto || "NORMAL", variadaRacionesNum,
       stockMinimoNum, unidadMedidaStr, outstockBool, outstockMotivo, grupoStr, id]
    );
  } catch {
    result = await pool.query(
      `UPDATE productos
       SET nombre = $1, descripcion = $2, costo = $3, precio_venta = $4, activo = $5, categoria_id = $6,
           tipo_producto = $7, variada_raciones = $8
       WHERE id = $9
       RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, created_at,
                 tipo_producto, stock_actual, variada_raciones`,
      [nombre, descripcion ?? null, costoNum, precioNum, activo ?? true, categoriaIdNum,
       tipoProducto || "NORMAL", variadaRacionesNum, id]
    );
  }

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const row = result.rows[0];

  let categoriaNombre: string | null = null;
  if (row.categoria_id) {
    const categoriaResult = await pool.query(
      `SELECT nombre FROM categorias WHERE id = $1`,
      [row.categoria_id]
    );
    categoriaNombre = categoriaResult.rows[0]?.nombre ?? null;
  }

  const extrasResult = await pool.query(
    `SELECT pe.id, pe.producto_id, pe.extra_id, pe.precio_adicional, ec.nombre
     FROM producto_extras pe
     JOIN extras_catalogo ec ON ec.id = pe.extra_id
     WHERE pe.producto_id = $1
     ORDER BY ec.nombre ASC`,
    [id]
  );

  const componentesResult = await pool.query(
    `SELECT pc.id, pc.producto_id, pc.componente_id, pc.cantidad, p2.nombre
     FROM producto_componentes pc
     JOIN productos p2 ON p2.id = pc.componente_id
     WHERE pc.producto_id = $1
     ORDER BY p2.nombre ASC`,
    [id]
  );

  return NextResponse.json({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    costo: Number(row.costo),
    precioVenta: Number(row.precio_venta),
    activo: row.activo,
    categoriaId: row.categoria_id,
    categoriaNombre,
    tipoProducto: row.tipo_producto,
    stockActual: Number(row.stock_actual),
    stockMinimo: Number(row.stock_minimo ?? 0),
    unidadMedida: row.unidad_medida ?? "unidad",
    alertaOutstockDesactivada: Boolean(row.alerta_outstock_desactivada),
    alertaOutstockMotivo: row.alerta_outstock_motivo ?? null,
    variadaRaciones: row.variada_raciones,
    grupo: row.grupo ?? "PARA_LA_VENTA",
    createdAt: row.created_at,
    extras: extrasResult.rows.map((extra) => ({
      id: extra.id,
      productoId: extra.producto_id,
      extraId: extra.extra_id,
      nombre: extra.nombre,
      precioAdicional: Number(extra.precio_adicional),
    })),
    componentes: componentesResult.rows.map((componente) => ({
      id: componente.id,
      productoId: componente.producto_id,
      componenteId: componente.componente_id,
      componenteNombre: componente.nombre,
      cantidad: Number(componente.cantidad),
    })),
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const result = await pool.query(`DELETE FROM productos WHERE id = $1`, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "No se puede eliminar: el producto tiene ventas registradas. Puedes desactivarlo en su lugar.",
      },
      { status: 409 }
    );
  }
}

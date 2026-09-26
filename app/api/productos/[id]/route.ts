import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { TIPOS_PRODUCTO } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const row = await pool.query(
    `SELECT p.id, p.imagen_url,
            p.unidad_medida_id, um.abreviatura AS unidad_medida_abreviatura
     FROM productos p
     LEFT JOIN unidades_medida um ON um.id = p.unidad_medida_id
     WHERE p.id = $1`,
    [id]
  );
  if (!row.rows[0]) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [extrasResult, componentesResult, empaquesResult] = await Promise.all([
    pool.query(
      `SELECT pe.id, pe.producto_id, pe.extra_id, pe.precio_adicional, ec.nombre
       FROM producto_extras pe
       JOIN extras_catalogo ec ON ec.id = pe.extra_id
       WHERE pe.producto_id = $1 ORDER BY ec.nombre ASC`,
      [id]
    ),
    pool.query(
      `SELECT pc.id, pc.producto_id, pc.componente_id, pc.cantidad, p2.nombre
       FROM producto_componentes pc
       JOIN productos p2 ON p2.id = pc.componente_id
       WHERE pc.producto_id = $1 ORDER BY p2.nombre ASC`,
      [id]
    ),
    pool.query(
      `SELECT pe.id, pe.unidad_id, pe.empaque_id, p2.nombre AS empaque_nombre,
              p2.stock_actual AS empaque_stock, pe.rendimiento, pe.prioridad
       FROM producto_empaques pe
       JOIN productos p2 ON p2.id = pe.empaque_id
       WHERE pe.unidad_id = $1 AND pe.activo = TRUE ORDER BY pe.prioridad ASC`,
      [id]
    ).catch(() => ({ rows: [] as Record<string, unknown>[] })),
  ]);

  return NextResponse.json({
    imagenUrl: row.rows[0].imagen_url ?? null,
    extras: extrasResult.rows.map((e) => ({
      id: e.id, productoId: e.producto_id, extraId: e.extra_id,
      nombre: e.nombre, precioAdicional: Number(e.precio_adicional),
    })),
    componentes: componentesResult.rows.map((c) => ({
      id: c.id, productoId: c.producto_id, componenteId: c.componente_id,
      componenteNombre: c.nombre, cantidad: Number(c.cantidad),
    })),
    empaques: empaquesResult.rows.map((e) => ({
      id: e.id, empaqueId: e.empaque_id, empaqueNombre: e.empaque_nombre,
      empaqueStock: Number(e.empaque_stock), rendimiento: e.rendimiento, prioridad: e.prioridad,
    })),
  });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const {
    nombre, descripcion, costo, precioVenta, activo, categoriaId, lineaId, tipoProducto, variadaRaciones,
    stockMinimo, unidadMedida, unidadMedidaId, alertaOutstockDesactivada, alertaOutstockMotivo, grupo, aprovisionamiento,
    subtipoFabricacion, tipoEmpaqueId,
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
  const lineaIdNum = lineaId ? Number(lineaId) : null;
  const variadaRacionesNum = Number(variadaRaciones) || 0;
  const stockMinimoNum = Math.max(0, Number(stockMinimo) || 0);
  const unidadMedidaStr = typeof unidadMedida === "string" && unidadMedida.trim() ? unidadMedida.trim() : "unidad";
  const unidadMedidaIdNum = unidadMedidaId ? Number(unidadMedidaId) : null;
  const outstockBool = Boolean(alertaOutstockDesactivada);
  const outstockMotivo = typeof alertaOutstockMotivo === "string" && alertaOutstockMotivo.trim() ? alertaOutstockMotivo.trim() : null;
  const grupoStr = ["PARA_LA_VENTA", "MATERIA_PRIMA", "SERVICIO"].includes(grupo) ? grupo : "PARA_LA_VENTA";
  const aprovisionamientoStr = aprovisionamiento === "FABRICACION" ? "FABRICACION" : "COMPRA";
  const SUBTIPOS_VALIDOS = ["RECETA_BASE", "ENSAMBLADO", "COMPUESTO"];
  const subtipoStr = subtipoFabricacion && SUBTIPOS_VALIDOS.includes(subtipoFabricacion) ? subtipoFabricacion : null;
  const tipoEmpaqueIdNum = tipoEmpaqueId ? Number(tipoEmpaqueId) : null;

  // Try with new columns first; fall back gracefully if migration 046 hasn't run yet
  let result;
  try {
    result = await pool.query(
      `UPDATE productos
       SET nombre = $1, descripcion = $2, costo = $3, precio_venta = $4, activo = $5, categoria_id = $6,
           tipo_producto = $7, variada_raciones = $8,
           stock_minimo = $9, unidad_medida = $10, unidad_medida_id = $11,
           alerta_outstock_desactivada = $12, alerta_outstock_motivo = $13,
           grupo = $14, linea_id = $15, aprovisionamiento = $16, subtipo_fabricacion = $17,
           tipo_empaque_id = $18
       WHERE id = $19
       RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, linea_id, created_at,
                 tipo_producto, stock_actual, variada_raciones,
                 stock_minimo, unidad_medida, unidad_medida_id, alerta_outstock_desactivada, alerta_outstock_motivo,
                 COALESCE(grupo, 'PARA_LA_VENTA') AS grupo,
                 COALESCE(aprovisionamiento, 'COMPRA') AS aprovisionamiento,
                 subtipo_fabricacion, tipo_empaque_id`,
      [nombre, descripcion ?? null, costoNum, precioNum, activo ?? true, categoriaIdNum,
       tipoProducto || "NORMAL", variadaRacionesNum,
       stockMinimoNum, unidadMedidaStr, unidadMedidaIdNum, outstockBool, outstockMotivo, grupoStr, lineaIdNum, aprovisionamientoStr, subtipoStr, tipoEmpaqueIdNum, id]
    );
  } catch {
    result = await pool.query(
      `UPDATE productos
       SET nombre = $1, descripcion = $2, costo = $3, precio_venta = $4, activo = $5, categoria_id = $6,
           tipo_producto = $7, variada_raciones = $8
       WHERE id = $9
       RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, created_at,
                 tipo_producto, stock_actual, variada_raciones,
                 NULL AS linea_id`,
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
      `SELECT nombre FROM familias WHERE id = $1`,
      [row.categoria_id]
    );
    categoriaNombre = categoriaResult.rows[0]?.nombre ?? null;
  }

  let lineaNombre: string | null = null;
  if (row.linea_id) {
    const lineaResult = await pool.query(
      `SELECT nombre FROM lineas WHERE id = $1`,
      [row.linea_id]
    );
    lineaNombre = lineaResult.rows[0]?.nombre ?? null;
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
    lineaId: row.linea_id ?? null,
    lineaNombre,
    tipoProducto: row.tipo_producto,
    stockActual: Number(row.stock_actual),
    stockMinimo: Number(row.stock_minimo ?? 0),
    unidadMedida: row.unidad_medida ?? "unidad",
    unidadMedidaId: row.unidad_medida_id ?? null,
    alertaOutstockDesactivada: Boolean(row.alerta_outstock_desactivada),
    alertaOutstockMotivo: row.alerta_outstock_motivo ?? null,
    variadaRaciones: row.variada_raciones,
    grupo: row.grupo ?? "PARA_LA_VENTA",
    aprovisionamiento: (row.aprovisionamiento ?? "COMPRA") as "COMPRA" | "FABRICACION",
    subtipoFabricacion: (row.subtipo_fabricacion ?? null) as "RECETA_BASE" | "ENSAMBLADO" | "COMPUESTO" | null,
    tipoEmpaqueId: row.tipo_empaque_id ?? null,
    tipoEmpaqueNombre: null,
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
    empaques: [],
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

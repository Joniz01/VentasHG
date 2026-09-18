import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { TIPOS_PRODUCTO } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit") ?? "200"), 200);

  const grupo = searchParams.get("grupo");

  // Si viene ?q= devolver búsqueda rápida para autocomplete
  if (q) {
    const grupoFilter = grupo ? ` AND COALESCE(p.grupo, 'PARA_LA_VENTA') = $3` : "";
    const params: (string | number)[] = [`%${q}%`, limit];
    if (grupo) params.push(grupo);
    const rows = await pool.query(
      `SELECT p.id, p.nombre, p.stock_actual
       FROM productos p
       WHERE p.activo = TRUE AND lower(p.nombre) LIKE lower($1)${grupoFilter}
       ORDER BY p.nombre ASC LIMIT $2`,
      params
    );
    return NextResponse.json({ productos: rows.rows.map(r => ({ id: r.id, nombre: r.nombre, stockActual: Number(r.stock_actual) })) });
  }

  // Intenta ordenar por c.orden si existe; si no (migración pendiente), ordena por nombre
  const GRUPOS_VALIDOS = ["PARA_LA_VENTA", "MATERIA_PRIMA", "SERVICIO"];
  const grupoValido = grupo && GRUPOS_VALIDOS.includes(grupo) ? grupo : null;
  let result;
  try {
    result = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.costo, p.precio_venta, p.activo, p.created_at,
              p.categoria_id, c.nombre AS categoria_nombre,
              p.linea_id, l.nombre AS linea_nombre,
              p.tipo_producto, p.stock_actual, p.variada_raciones,
              COALESCE(p.stock_minimo, 0) AS stock_minimo,
              COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
              p.unidad_medida_id, um.nombre AS unidad_medida_nombre, um.abreviatura AS unidad_medida_abreviatura,
              COALESCE(p.alerta_outstock_desactivada, FALSE) AS alerta_outstock_desactivada,
              p.alerta_outstock_motivo,
              COALESCE(p.grupo, 'PARA_LA_VENTA') AS grupo,
              COALESCE(p.aprovisionamiento, 'COMPRA') AS aprovisionamiento,
              p.subtipo_fabricacion,
              p.imagen_url
       FROM productos p
       LEFT JOIN familias c ON c.id = p.categoria_id
       LEFT JOIN lineas l ON l.id = p.linea_id
       LEFT JOIN unidades_medida um ON um.id = p.unidad_medida_id
       ${grupoValido ? `WHERE p.activo = TRUE AND COALESCE(p.grupo, 'PARA_LA_VENTA') = $1` : ""}
       ORDER BY COALESCE(c.orden, 99) ASC, c.nombre ASC NULLS LAST, p.nombre ASC`,
      grupoValido ? [grupoValido] : []
    );
  } catch {
    result = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.costo, p.precio_venta, p.activo, p.created_at,
              p.categoria_id, c.nombre AS categoria_nombre,
              NULL AS linea_id, NULL AS linea_nombre,
              p.tipo_producto, p.stock_actual, p.variada_raciones,
              0 AS stock_minimo, 'unidad' AS unidad_medida,
              FALSE AS alerta_outstock_desactivada, NULL AS alerta_outstock_motivo,
              'PARA_LA_VENTA' AS grupo,
              'COMPRA' AS aprovisionamiento,
              NULL AS subtipo_fabricacion
       FROM productos p
       LEFT JOIN familias c ON c.id = p.categoria_id
       ${grupoValido ? `WHERE p.activo = TRUE AND COALESCE(p.grupo, 'PARA_LA_VENTA') = $1` : ""}
       ORDER BY c.nombre ASC NULLS LAST, p.nombre ASC`,
      grupoValido ? [grupoValido] : []
    );
  }

  const productoIds = result.rows.map((row) => row.id);

  const extrasResult = productoIds.length
    ? await pool.query(
        `SELECT pe.id, pe.producto_id, pe.extra_id, pe.precio_adicional, ec.nombre
         FROM producto_extras pe
         JOIN extras_catalogo ec ON ec.id = pe.extra_id
         WHERE pe.producto_id = ANY($1::int[])
         ORDER BY ec.nombre ASC`,
        [productoIds]
      )
    : { rows: [] };

  const componentesResult = productoIds.length
    ? await pool.query(
        `SELECT pc.id, pc.producto_id, pc.componente_id, pc.cantidad, p2.nombre
         FROM producto_componentes pc
         JOIN productos p2 ON p2.id = pc.componente_id
         WHERE pc.producto_id = ANY($1::int[])
         ORDER BY p2.nombre ASC`,
        [productoIds]
      )
    : { rows: [] };

  let empaquesResult: { rows: Record<string, unknown>[] } = { rows: [] };
  if (productoIds.length) {
    try {
      empaquesResult = await pool.query(
        `SELECT pe.id, pe.unidad_id, pe.empaque_id, p2.nombre AS empaque_nombre,
                p2.stock_actual AS empaque_stock, pe.rendimiento, pe.prioridad
         FROM producto_empaques pe
         JOIN productos p2 ON p2.id = pe.empaque_id
         WHERE pe.unidad_id = ANY($1::int[]) AND pe.activo = TRUE
         ORDER BY pe.prioridad ASC`,
        [productoIds]
      );
    } catch {
      // tabla aún no migrada — fallback a vacío
    }
  }

  const productos = result.rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    descripcion: row.descripcion,
    costo: Number(row.costo),
    precioVenta: Number(row.precio_venta),
    activo: row.activo,
    categoriaId: row.categoria_id,
    categoriaNombre: row.categoria_nombre,
    lineaId: row.linea_id ?? null,
    lineaNombre: row.linea_nombre ?? null,
    tipoProducto: row.tipo_producto,
    stockActual: Number(row.stock_actual),
    stockMinimo: Number(row.stock_minimo),
    unidadMedida: row.unidad_medida ?? "unidad",
    unidadMedidaId: row.unidad_medida_id ?? null,
    unidadMedidaNombre: row.unidad_medida_nombre ?? null,
    unidadMedidaAbreviatura: row.unidad_medida_abreviatura ?? null,
    alertaOutstockDesactivada: Boolean(row.alerta_outstock_desactivada),
    alertaOutstockMotivo: row.alerta_outstock_motivo ?? null,
    variadaRaciones: row.variada_raciones,
    grupo: row.grupo ?? "PARA_LA_VENTA",
    aprovisionamiento: (row.aprovisionamiento ?? "COMPRA") as "COMPRA" | "FABRICACION",
    subtipoFabricacion: (row.subtipo_fabricacion ?? null) as "RECETA_BASE" | "ENSAMBLADO" | "COMPUESTO" | null,
    imagenUrl: row.imagen_url ?? null,
    createdAt: row.created_at,
    extras: extrasResult.rows
      .filter((extra) => extra.producto_id === row.id)
      .map((extra) => ({
        id: extra.id,
        productoId: extra.producto_id,
        extraId: extra.extra_id,
        nombre: extra.nombre,
        precioAdicional: Number(extra.precio_adicional),
      })),
    componentes: componentesResult.rows
      .filter((componente) => componente.producto_id === row.id)
      .map((componente) => ({
        id: componente.id,
        productoId: componente.producto_id,
        componenteId: componente.componente_id,
        componenteNombre: componente.nombre,
        cantidad: Number(componente.cantidad),
      })),
    empaques: empaquesResult.rows
      .filter((e) => e.unidad_id === row.id)
      .map((e) => ({
        id: e.id,
        empaqueId: e.empaque_id,
        empaqueNombre: e.empaque_nombre,
        empaqueStock: Number(e.empaque_stock),
        rendimiento: e.rendimiento,
        prioridad: e.prioridad,
      })),
  }));

  return NextResponse.json(productos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, descripcion, costo, precioVenta, categoriaId, lineaId, tipoProducto, variadaRaciones, aprovisionamiento, unidadMedida, unidadMedidaId } = body;

  if (!nombre || typeof nombre !== "string") {
    return NextResponse.json(
      { error: "El nombre del producto es obligatorio" },
      { status: 400 }
    );
  }

  // Validar nombre duplicado
  const existing = await pool.query(
    `SELECT id FROM productos WHERE lower(nombre) = lower($1) LIMIT 1`,
    [nombre.trim()]
  );
  if ((existing.rowCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Ya existe un producto con el nombre "${nombre.trim()}"` },
      { status: 409 }
    );
  }

  const costoNum = Number(costo);
  const precioNum = Number(precioVenta);

  if (Number.isNaN(costoNum) || Number.isNaN(precioNum)) {
    return NextResponse.json(
      { error: "Costo y precio de venta deben ser numéricos" },
      { status: 400 }
    );
  }

  if (tipoProducto && !TIPOS_PRODUCTO.includes(tipoProducto)) {
    return NextResponse.json({ error: "Tipo de producto inválido" }, { status: 400 });
  }

  const categoriaIdNum = categoriaId ? Number(categoriaId) : null;
  const lineaIdNum = lineaId ? Number(lineaId) : null;
  const variadaRacionesNum = Number(variadaRaciones) || 0;

  const aprovisionamientoVal = aprovisionamiento === "FABRICACION" ? "FABRICACION" : "COMPRA";
  const unidadMedidaStr = typeof unidadMedida === "string" && unidadMedida.trim() ? unidadMedida.trim() : null;
  const unidadMedidaIdNum = unidadMedidaId ? Number(unidadMedidaId) : null;

  const result = await pool.query(
    `INSERT INTO productos (nombre, descripcion, costo, precio_venta, categoria_id, linea_id, tipo_producto, variada_raciones, aprovisionamiento, unidad_medida, unidad_medida_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, linea_id, created_at, tipo_producto, stock_actual, variada_raciones, aprovisionamiento, unidad_medida, unidad_medida_id`,
    [nombre, descripcion ?? null, costoNum, precioNum, categoriaIdNum, lineaIdNum, tipoProducto || "NORMAL", variadaRacionesNum, aprovisionamientoVal, unidadMedidaStr, unidadMedidaIdNum]
  );

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

  return NextResponse.json(
    {
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
      stockMinimo: 0,
      unidadMedida: row.unidad_medida ?? "unidad",
      unidadMedidaId: row.unidad_medida_id ?? null,
      alertaOutstockDesactivada: false,
      alertaOutstockMotivo: null,
      subtipoFabricacion: null,
      variadaRaciones: row.variada_raciones,
      createdAt: row.created_at,
      extras: [],
      componentes: [],
      empaques: [],
    },
    { status: 201 }
  );
}

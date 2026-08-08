import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { TIPOS_PRODUCTO } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limit = Math.min(Number(searchParams.get("limit") ?? "200"), 200);

  // Si viene ?q= devolver búsqueda rápida para autocomplete
  if (q) {
    const rows = await pool.query(
      `SELECT p.id, p.nombre, p.stock_actual
       FROM productos p
       WHERE p.activo = TRUE AND lower(p.nombre) LIKE lower($1)
       ORDER BY p.nombre ASC LIMIT $2`,
      [`%${q}%`, limit]
    );
    return NextResponse.json({ productos: rows.rows.map(r => ({ id: r.id, nombre: r.nombre, stockActual: Number(r.stock_actual) })) });
  }

  // Intenta ordenar por c.orden si existe; si no (migración pendiente), ordena por nombre
  let result;
  try {
    result = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.costo, p.precio_venta, p.activo, p.created_at,
              p.categoria_id, c.nombre AS categoria_nombre,
              p.tipo_producto, p.stock_actual, p.variada_raciones,
              COALESCE(p.stock_minimo, 0) AS stock_minimo,
              COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
              COALESCE(p.alerta_outstock_desactivada, FALSE) AS alerta_outstock_desactivada,
              p.alerta_outstock_motivo,
              COALESCE(p.grupo, 'PARA_LA_VENTA') AS grupo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ORDER BY COALESCE(c.orden, 99) ASC, c.nombre ASC NULLS LAST, p.nombre ASC`
    );
  } catch {
    result = await pool.query(
      `SELECT p.id, p.nombre, p.descripcion, p.costo, p.precio_venta, p.activo, p.created_at,
              p.categoria_id, c.nombre AS categoria_nombre,
              p.tipo_producto, p.stock_actual, p.variada_raciones,
              0 AS stock_minimo, 'unidad' AS unidad_medida,
              FALSE AS alerta_outstock_desactivada, NULL AS alerta_outstock_motivo,
              'PARA_LA_VENTA' AS grupo
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       ORDER BY c.nombre ASC NULLS LAST, p.nombre ASC`
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
    tipoProducto: row.tipo_producto,
    stockActual: Number(row.stock_actual),
    stockMinimo: Number(row.stock_minimo),
    unidadMedida: row.unidad_medida ?? "unidad",
    alertaOutstockDesactivada: Boolean(row.alerta_outstock_desactivada),
    alertaOutstockMotivo: row.alerta_outstock_motivo ?? null,
    variadaRaciones: row.variada_raciones,
    grupo: row.grupo ?? "PARA_LA_VENTA",
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
  const { nombre, descripcion, costo, precioVenta, categoriaId, tipoProducto, variadaRaciones } = body;

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
  const variadaRacionesNum = Number(variadaRaciones) || 0;

  const result = await pool.query(
    `INSERT INTO productos (nombre, descripcion, costo, precio_venta, categoria_id, tipo_producto, variada_raciones)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, nombre, descripcion, costo, precio_venta, activo, categoria_id, created_at, tipo_producto, stock_actual, variada_raciones`,
    [nombre, descripcion ?? null, costoNum, precioNum, categoriaIdNum, tipoProducto || "NORMAL", variadaRacionesNum]
  );

  const row = result.rows[0];

  let categoriaNombre: string | null = null;
  if (row.categoria_id) {
    const categoriaResult = await pool.query(
      `SELECT nombre FROM categorias WHERE id = $1`,
      [row.categoria_id]
    );
    categoriaNombre = categoriaResult.rows[0]?.nombre ?? null;
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
      tipoProducto: row.tipo_producto,
      stockActual: Number(row.stock_actual),
      stockMinimo: 0,
      unidadMedida: "unidad",
      alertaOutstockDesactivada: false,
      alertaOutstockMotivo: null,
      variadaRaciones: row.variada_raciones,
      createdAt: row.created_at,
      extras: [],
      componentes: [],
      empaques: [],
    },
    { status: 201 }
  );
}

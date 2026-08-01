import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { TIPOS_MOVIMIENTO_INVENTARIO } from "@/lib/types";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  // Try with new audit columns first; fall back if migration 047 not applied
  let result;
  try {
    result = await pool.query(
      `SELECT im.id, im.producto_id, im.tipo, im.cantidad, im.nota, im.venta_id, im.created_at,
              im.usuario_id, COALESCE(im.origen, 'MANUAL') AS origen,
              u.nombre AS usuario_nombre
       FROM inventario_movimientos im
       LEFT JOIN usuarios u ON u.id = im.usuario_id
       WHERE im.producto_id = $1
       ORDER BY im.created_at DESC, im.id DESC`,
      [id]
    );
  } catch {
    result = await pool.query(
      `SELECT id, producto_id, tipo, cantidad, nota, venta_id, created_at
       FROM inventario_movimientos
       WHERE producto_id = $1
       ORDER BY created_at DESC, id DESC`,
      [id]
    );
  }

  return NextResponse.json(
    result.rows.map((row) => ({
      id: row.id,
      productoId: row.producto_id,
      tipo: row.tipo,
      cantidad: Number(row.cantidad),
      nota: row.nota,
      ventaId: row.venta_id,
      usuarioId: row.usuario_id ?? null,
      usuarioNombre: row.usuario_nombre ?? null,
      origen: row.origen ?? "MANUAL",
      createdAt: row.created_at,
    }))
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const sesion = await getSesionFromRequest(request);
  const body = await request.json();
  const { tipo, cantidad, nota } = body;

  if (!TIPOS_MOVIMIENTO_INVENTARIO.includes(tipo) || tipo === "VENTA") {
    return NextResponse.json({ error: "Tipo de movimiento inválido" }, { status: 400 });
  }

  const cantidadNum = Number(cantidad);
  if (Number.isNaN(cantidadNum) || cantidadNum === 0) {
    return NextResponse.json({ error: "La cantidad debe ser numérica y distinta de 0" }, { status: 400 });
  }

  if (tipo === "ENTRADA" && cantidadNum <= 0) {
    return NextResponse.json({ error: "La cantidad de una entrada debe ser mayor a 0" }, { status: 400 });
  }

  const notaTexto = typeof nota === "string" ? nota.trim() : "";
  if (tipo === "AJUSTE" && !notaTexto) {
    return NextResponse.json({ error: "Debes indicar el motivo del ajuste" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productoResult = await client.query(
      `SELECT id, stock_actual,
              COALESCE(alerta_outstock_desactivada, FALSE) AS alerta_outstock_desactivada
       FROM productos WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (productoResult.rowCount === 0) {
      throw new Error("Producto no encontrado");
    }

    if (productoResult.rows[0].alerta_outstock_desactivada) {
      throw new Error("OUTSTOCK_DESACTIVADO");
    }

    const stockActual = Number(productoResult.rows[0].stock_actual);
    const nuevoStock = stockActual + cantidadNum;

    if (nuevoStock < 0) {
      throw new Error("El ajuste dejaría el inventario en negativo");
    }

    await client.query(`UPDATE productos SET stock_actual = $1 WHERE id = $2`, [nuevoStock, id]);

    // Insert with audit fields if migration 047 applied; otherwise fall back
    let movimientoResult;
    try {
      movimientoResult = await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
         VALUES ($1, $2, $3, $4, $5, 'MANUAL')
         RETURNING id, producto_id, tipo, cantidad, nota, venta_id, created_at, usuario_id, origen`,
        [id, tipo, cantidadNum, notaTexto || null, sesion?.id ?? null]
      );
    } catch {
      movimientoResult = await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
         VALUES ($1, $2, $3, $4)
         RETURNING id, producto_id, tipo, cantidad, nota, venta_id, created_at`,
        [id, tipo, cantidadNum, notaTexto || null]
      );
    }

    await client.query("COMMIT");

    const row = movimientoResult.rows[0];

    return NextResponse.json(
      {
        id: row.id,
        productoId: row.producto_id,
        tipo: row.tipo,
        cantidad: Number(row.cantidad),
        nota: row.nota,
        ventaId: row.venta_id,
        usuarioId: row.usuario_id ?? null,
        usuarioNombre: sesion?.nombre ?? null,
        origen: row.origen ?? "MANUAL",
        createdAt: row.created_at,
        stockActual: nuevoStock,
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al registrar el movimiento";
    if (message === "OUTSTOCK_DESACTIVADO") {
      return NextResponse.json(
        { error: "Este producto tiene la alerta OutStock desactivada. Desmarca el check antes de registrar un movimiento.", code: "OUTSTOCK_DESACTIVADO" },
        { status: 409 }
      );
    }
    const status = message === "Producto no encontrado" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  } finally {
    client.release();
  }
}

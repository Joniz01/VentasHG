import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const MOTIVOS_AJUSTE = [
  "MERMA",
  "VENCIMIENTO",
  "PERDIDA",
  "ROBO",
  "CORRECCION",
  "PRODUCCION",
  "DONACION",
  "OTRO",
] as const;

export type MotivoAjuste = (typeof MOTIVOS_AJUSTE)[number];

export const MOTIVO_LABELS: Record<MotivoAjuste, string> = {
  MERMA:      "Merma / Deterioro",
  VENCIMIENTO:"Vencimiento",
  PERDIDA:    "Pérdida",
  ROBO:       "Robo",
  CORRECCION: "Corrección de inventario",
  PRODUCCION: "Producción propia",
  DONACION:   "Donación / Cortesía",
  OTRO:       "Otro",
};

// GET — products available for adjustment
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.stock_actual,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN familias c ON c.id = p.categoria_id
      WHERE p.activo = TRUE
        AND COALESCE(p.grupo, 'PARA_LA_VENTA') != 'ARCHIVADO'
      ORDER BY c.nombre ASC NULLS LAST, p.nombre ASC
    `);
    return NextResponse.json(
      result.rows.map((r) => ({
        id:             r.id,
        nombre:         r.nombre,
        stockActual:    Number(r.stock_actual),
        unidadMedida:   r.unidad_medida,
        categoriaNombre: r.categoria_nombre ?? null,
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — register a single adjustment
export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  const body = await request.json();
  const { productoId, cantidad, motivo, nota } = body;

  if (!productoId || typeof productoId !== "number") {
    return NextResponse.json({ error: "productoId inválido" }, { status: 400 });
  }
  const cantidadNum = Number(cantidad);
  if (Number.isNaN(cantidadNum) || cantidadNum === 0) {
    return NextResponse.json({ error: "La cantidad debe ser distinta de 0" }, { status: 400 });
  }
  if (!MOTIVOS_AJUSTE.includes(motivo)) {
    return NextResponse.json({ error: "Motivo inválido" }, { status: 400 });
  }
  const notaTexto = typeof nota === "string" ? nota.trim() : "";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prod = await client.query(
      `SELECT id, nombre, stock_actual FROM productos WHERE id = $1 AND activo = TRUE FOR UPDATE`,
      [productoId]
    );
    if (prod.rowCount === 0) {
      throw new Error("Producto no encontrado");
    }

    const stockActual = Number(prod.rows[0].stock_actual);
    const nuevoStock = stockActual + cantidadNum;
    if (nuevoStock < 0) {
      throw new Error(`El ajuste dejaría el stock en ${nuevoStock.toFixed(2)} (negativo)`);
    }

    await client.query(`UPDATE productos SET stock_actual = $1 WHERE id = $2`, [nuevoStock, productoId]);

    let mov;
    try {
      mov = await client.query(
        `INSERT INTO inventario_movimientos
           (producto_id, tipo, cantidad, nota, usuario_id, origen, motivo_ajuste)
         VALUES ($1, 'AJUSTE', $2, $3, $4, 'MANUAL', $5)
         RETURNING id, created_at`,
        [productoId, cantidadNum, notaTexto || null, sesion?.id ?? null, motivo]
      );
    } catch {
      // fallback: motivo_ajuste column may not be present yet
      mov = await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
         VALUES ($1, 'AJUSTE', $2, $3, $4, 'MANUAL')
         RETURNING id, created_at`,
        [productoId, cantidadNum, notaTexto || null, sesion?.id ?? null]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        id:          mov.rows[0].id,
        productoId,
        nombre:      prod.rows[0].nombre,
        stockAntes:  stockActual,
        stockDespues: nuevoStock,
        cantidad:    cantidadNum,
        motivo,
        nota:        notaTexto || null,
        createdAt:   mov.rows[0].created_at,
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : "Error al registrar el ajuste";
    return NextResponse.json({ error: msg }, { status: 400 });
  } finally {
    client.release();
  }
}

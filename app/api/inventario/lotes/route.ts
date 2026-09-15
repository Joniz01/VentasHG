import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

// GET — all active lots with expiry status
export async function GET(request: NextRequest) {
  const soloAlertas = request.nextUrl.searchParams.get("alertas") === "1";

  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.producto_id,
        l.numero_lote,
        l.fecha_entrada,
        l.fecha_vencimiento,
        l.cantidad_inicial,
        l.cantidad_actual,
        l.compra_id,
        l.activo,
        l.created_at,
        p.nombre              AS producto_nombre,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        COALESCE(p.dias_alerta_vencimiento, 7) AS dias_alerta,
        f.nombre              AS categoria_nombre,
        -- days until expiry (null if no expiry date)
        CASE WHEN l.fecha_vencimiento IS NOT NULL
          THEN (l.fecha_vencimiento - CURRENT_DATE)::int
          ELSE NULL
        END AS dias_para_vencer
      FROM lotes_inventario l
      JOIN productos p ON p.id = l.producto_id
      LEFT JOIN familias f ON f.id = p.categoria_id
      WHERE l.activo = TRUE AND l.cantidad_actual > 0
      ${soloAlertas ? `AND l.fecha_vencimiento IS NOT NULL AND (l.fecha_vencimiento - CURRENT_DATE) <= COALESCE(p.dias_alerta_vencimiento, 7)` : ""}
      ORDER BY
        CASE
          WHEN l.fecha_vencimiento IS NULL THEN 2
          WHEN l.fecha_vencimiento < CURRENT_DATE THEN 0
          WHEN (l.fecha_vencimiento - CURRENT_DATE) <= COALESCE(p.dias_alerta_vencimiento, 7) THEN 1
          ELSE 2
        END,
        l.fecha_vencimiento ASC NULLS LAST,
        p.nombre ASC
    `);

    return NextResponse.json(
      result.rows.map((r) => ({
        id:               r.id,
        productoId:       r.producto_id,
        productoNombre:   r.producto_nombre,
        unidadMedida:     r.unidad_medida,
        categoriaNombre:  r.categoria_nombre ?? null,
        numeroLote:       r.numero_lote,
        fechaEntrada:     r.fecha_entrada,
        fechaVencimiento: r.fecha_vencimiento ?? null,
        cantidadInicial:  Number(r.cantidad_inicial),
        cantidadActual:   Number(r.cantidad_actual),
        compraId:         r.compra_id ?? null,
        diasParaVencer:   r.dias_para_vencer !== null ? Number(r.dias_para_vencer) : null,
        diasAlerta:       Number(r.dias_alerta),
        createdAt:        r.created_at,
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — create a new lot
export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  const body = await request.json();
  const { productoId, numeroLote, fechaEntrada, fechaVencimiento, cantidad, compraId } = body;

  if (!productoId || typeof productoId !== "number") {
    return NextResponse.json({ error: "productoId inválido" }, { status: 400 });
  }
  const cantidadNum = Number(cantidad);
  if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
    return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 });
  }
  if (!numeroLote || typeof numeroLote !== "string" || !numeroLote.trim()) {
    return NextResponse.json({ error: "Número de lote requerido" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prod = await client.query(
      `SELECT id, nombre FROM productos WHERE id = $1 AND activo = TRUE`,
      [productoId]
    );
    if (prod.rowCount === 0) throw new Error("Producto no encontrado");

    const lote = await client.query(
      `INSERT INTO lotes_inventario
         (producto_id, numero_lote, fecha_entrada, fecha_vencimiento, cantidad_inicial, cantidad_actual, compra_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
       RETURNING *`,
      [
        productoId,
        numeroLote.trim(),
        fechaEntrada || new Date().toISOString().slice(0, 10),
        fechaVencimiento || null,
        cantidadNum,
        compraId || null,
        sesion?.id ?? null,
      ]
    );

    await client.query("COMMIT");

    const r = lote.rows[0];
    return NextResponse.json(
      {
        id:               r.id,
        productoId:       r.producto_id,
        productoNombre:   prod.rows[0].nombre,
        numeroLote:       r.numero_lote,
        fechaEntrada:     r.fecha_entrada,
        fechaVencimiento: r.fecha_vencimiento ?? null,
        cantidadInicial:  Number(r.cantidad_inicial),
        cantidadActual:   Number(r.cantidad_actual),
        compraId:         r.compra_id ?? null,
        createdAt:        r.created_at,
      },
      { status: 201 }
    );
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : "Error al crear el lote";
    const status = msg.includes("uq_lote_producto") ? 409 : 400;
    const userMsg = msg.includes("uq_lote_producto")
      ? "Ya existe un lote con ese número para este producto"
      : msg;
    return NextResponse.json({ error: userMsg }, { status });
  } finally {
    client.release();
  }
}

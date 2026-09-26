import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET: RP de un producto específico
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productoId = Number(id);

  try {
    const [rp, prod] = await Promise.all([
      pool.query(`
        SELECT
          ri.id,
          ri.insumo_id,
          p.nombre AS insumo_nombre,
          COALESCE(p.unidad_medida, 'unidad') AS insumo_unidad,
          p.stock_actual AS stock_insumo,
          COALESCE(p.aprovisionamiento, 'COMPRA') AS insumo_aprovisionamiento,
          p.subtipo_fabricacion AS insumo_subtipo,
          ri.cantidad,
          COALESCE(ri.factor_merma, 1.0) AS factor_merma,
          ri.unidad_medida,
          ri.notas,
          ri.orden
        FROM rp_items ri
        JOIN productos p ON p.id = ri.insumo_id
        WHERE ri.producto_id = $1 AND ri.activo = TRUE
        ORDER BY ri.orden ASC, p.nombre ASC
      `, [productoId]),
      pool.query(`
        SELECT id, nombre, COALESCE(rp_rendimiento, 1) AS rendimiento,
               COALESCE(aprovisionamiento, 'COMPRA') AS aprovisionamiento,
               subtipo_fabricacion
        FROM productos WHERE id = $1
      `, [productoId]),
    ]);

    if (prod.rows.length === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    return NextResponse.json({
      producto: prod.rows[0],
      items: rp.rows.map((r) => ({
        id: r.id,
        insumoId: r.insumo_id,
        insumoNombre: r.insumo_nombre,
        insumoUnidad: r.insumo_unidad,
        stockInsumo: Number(r.stock_insumo),
        insumoAprovisionamiento: r.insumo_aprovisionamiento,
        insumoSubtipo: r.insumo_subtipo ?? null,
        cantidad: Number(r.cantidad),
        factorMerma: Number(r.factor_merma ?? 1),
        unidadMedida: r.unidad_medida,
        notas: r.notas,
        orden: r.orden,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST: agregar insumo a la RP
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productoId = Number(id);
  const body = await req.json();
  const { insumoId, cantidad, factorMerma, unidadMedida, notas, orden } = body;

  if (!insumoId || !cantidad || cantidad <= 0) {
    return NextResponse.json({ error: "insumoId y cantidad > 0 son requeridos" }, { status: 400 });
  }
  if (insumoId === productoId) {
    return NextResponse.json({ error: "Un producto no puede ser insumo de sí mismo" }, { status: 400 });
  }
  const mermaNum = Math.max(1, Number(factorMerma) || 1);

  try {
    let result;
    try {
      result = await pool.query(`
        INSERT INTO rp_items (producto_id, insumo_id, cantidad, factor_merma, unidad_medida, notas, orden)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (producto_id, insumo_id) DO UPDATE
          SET cantidad = EXCLUDED.cantidad,
              factor_merma = EXCLUDED.factor_merma,
              unidad_medida = EXCLUDED.unidad_medida,
              notas = EXCLUDED.notas,
              orden = EXCLUDED.orden,
              activo = TRUE,
              updated_at = now()
        RETURNING *
      `, [productoId, insumoId, cantidad, mermaNum, unidadMedida ?? "unidad", notas ?? null, orden ?? 0]);
    } catch {
      result = await pool.query(`
        INSERT INTO rp_items (producto_id, insumo_id, cantidad, unidad_medida, notas, orden)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (producto_id, insumo_id) DO UPDATE
          SET cantidad = EXCLUDED.cantidad,
              unidad_medida = EXCLUDED.unidad_medida,
              notas = EXCLUDED.notas,
              orden = EXCLUDED.orden,
              activo = TRUE,
              updated_at = now()
        RETURNING *
      `, [productoId, insumoId, cantidad, unidadMedida ?? "unidad", notas ?? null, orden ?? 0]);
    }

    return NextResponse.json({ ok: true, item: result.rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: actualizar rendimiento del producto
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productoId = Number(id);
  const body = await req.json();

  if (body.rendimiento !== undefined) {
    const r = Number(body.rendimiento);
    if (isNaN(r) || r <= 0) return NextResponse.json({ error: "Rendimiento inválido" }, { status: 400 });
    await pool.query("UPDATE productos SET rp_rendimiento = $1 WHERE id = $2", [r, productoId]);
  }

  return NextResponse.json({ ok: true });
}

// DELETE: eliminar insumo de la RP
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const productoId = Number(id);
  const { searchParams } = new URL(req.url);
  const itemId = Number(searchParams.get("itemId"));

  if (!itemId) return NextResponse.json({ error: "itemId requerido" }, { status: 400 });

  try {
    await pool.query(
      "UPDATE rp_items SET activo = FALSE WHERE id = $1 AND producto_id = $2",
      [itemId, productoId]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Consumo = { insumoId: number; nombre: string; unidadMedida: string; cantidadPlanificada: number; nivel: number };

async function explotar(
  productoId: number,
  cantidadNeta: number,
  nivelMax: number,
  nivel: number,
  acumulado: Map<number, Consumo>,
  visitados: Set<number>
): Promise<void> {
  if (nivel > nivelMax) return;

  const prod = await pool.query(
    `SELECT COALESCE(rp_rendimiento, 1) AS rendimiento FROM productos WHERE id = $1 AND activo = TRUE`,
    [productoId]
  );
  if (prod.rows.length === 0) return;

  const lotes = cantidadNeta / Number(prod.rows[0].rendimiento);

  const items = await pool.query(
    `SELECT ri.insumo_id, p.nombre, COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
            COALESCE(p.aprovisionamiento, 'COMPRA') AS aprovisionamiento,
            ri.cantidad AS cantidad_por_lote,
            COALESCE(ri.factor_merma, 1.0) AS factor_merma
     FROM rp_items ri
     JOIN productos p ON p.id = ri.insumo_id
     WHERE ri.producto_id = $1 AND ri.activo = TRUE`,
    [productoId]
  );

  for (const r of items.rows) {
    const insumoId = Number(r.insumo_id);
    const cantidadBruta = Number(r.cantidad_por_lote) * lotes * Number(r.factor_merma);
    if (String(r.aprovisionamiento) === "FABRICACION" && !visitados.has(insumoId)) {
      visitados.add(insumoId);
      await explotar(insumoId, cantidadBruta, nivelMax, nivel + 1, acumulado, visitados);
      visitados.delete(insumoId);
    } else {
      const ex = acumulado.get(insumoId);
      if (ex) {
        ex.cantidadPlanificada += cantidadBruta;
      } else {
        acumulado.set(insumoId, { insumoId, nombre: String(r.nombre), unidadMedida: String(r.unidad_medida), cantidadPlanificada: cantidadBruta, nivel });
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const productoId = searchParams.get("productoId");

  try {
    let q = `
      SELECT op.id, op.producto_id, op.estado, op.cantidad_planificada, op.cantidad_producida,
             op.fecha_planificada, op.fecha_inicio, op.fecha_fin, op.notas, op.created_at,
             p.nombre AS producto_nombre, COALESCE(p.unidad_medida, 'unidad') AS unidad_medida
      FROM ordenes_produccion op
      JOIN productos p ON p.id = op.producto_id
      WHERE 1=1`;
    const params: unknown[] = [];
    if (estado && estado !== "TODAS") { params.push(estado); q += ` AND op.estado = $${params.length}`; }
    if (productoId) { params.push(Number(productoId)); q += ` AND op.producto_id = $${params.length}`; }
    q += ` ORDER BY op.created_at DESC LIMIT 200`;

    const result = await pool.query(q, params);
    return NextResponse.json({ items: result.rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const productoId = Number(body.productoId);
  const cantidadPlanificada = Number(body.cantidadPlanificada);
  const fechaPlanificada = body.fechaPlanificada || null;
  const notas = body.notas || null;

  if (!productoId || !cantidadPlanificada || cantidadPlanificada <= 0) {
    return NextResponse.json({ error: "productoId y cantidadPlanificada > 0 requeridos" }, { status: 400 });
  }

  try {
    const prod = await pool.query(
      `SELECT id, nombre FROM productos WHERE id = $1 AND activo = TRUE AND COALESCE(aprovisionamiento, 'COMPRA') = 'FABRICACION'`,
      [productoId]
    );
    if (prod.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado o no es de fabricación" }, { status: 404 });
    }

    const acumulado = new Map<number, Consumo>();
    await explotar(productoId, cantidadPlanificada, 10, 1, acumulado, new Set([productoId]));
    const consumos = Array.from(acumulado.values());

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(
        `INSERT INTO ordenes_produccion (producto_id, cantidad_planificada, fecha_planificada, notas)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [productoId, cantidadPlanificada, fechaPlanificada, notas]
      );
      const ordenId = res.rows[0].id;
      for (const c of consumos) {
        await client.query(
          `INSERT INTO op_consumos (orden_id, insumo_id, cantidad_planificada) VALUES ($1, $2, $3)`,
          [ordenId, c.insumoId, Math.round(c.cantidadPlanificada * 10000) / 10000]
        );
      }
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, id: ordenId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

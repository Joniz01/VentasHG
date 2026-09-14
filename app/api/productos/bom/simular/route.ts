import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// POST: simular producción de N unidades de un producto
// Body: { productoId: number, cantidad: number }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const productoId = Number(body.productoId);
  const cantidadProducir = Number(body.cantidad);

  if (!productoId || isNaN(cantidadProducir) || cantidadProducir <= 0) {
    return NextResponse.json({ error: "productoId y cantidad > 0 requeridos" }, { status: 400 });
  }

  try {
    const prodRes = await pool.query(`
      SELECT id, nombre, COALESCE(rp_rendimiento, 1) AS rendimiento
      FROM productos WHERE id = $1 AND activo = TRUE
    `, [productoId]);

    if (prodRes.rows.length === 0) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const { nombre, rendimiento } = prodRes.rows[0];
    const lotes = cantidadProducir / Number(rendimiento);

    const itemsRes = await pool.query(`
      SELECT
        ri.id,
        ri.insumo_id,
        p.nombre     AS insumo_nombre,
        COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
        p.stock_actual,
        ri.cantidad  AS cantidad_por_lote
      FROM rp_items ri
      JOIN productos p ON p.id = ri.insumo_id
      WHERE ri.producto_id = $1 AND ri.activo = TRUE
      ORDER BY ri.orden ASC, p.nombre ASC
    `, [productoId]);

    const necesidades = itemsRes.rows.map((r) => {
      const necesario = Number(r.cantidad_por_lote) * lotes;
      const disponible = Number(r.stock_actual);
      const deficit = Math.max(0, necesario - disponible);
      return {
        insumoId:       r.insumo_id,
        nombre:         r.insumo_nombre,
        unidadMedida:   r.unidad_medida,
        necesario:      Math.round(necesario * 1000) / 1000,
        disponible,
        deficit:        Math.round(deficit * 1000) / 1000,
        ok:             deficit === 0,
      };
    });

    // Máximo que se puede producir con stock actual
    const factoresDisponibles = necesidades.map((n) =>
      n.necesario > 0 ? n.disponible / n.necesario : Infinity
    );
    const factorMax = factoresDisponibles.length > 0 ? Math.min(...factoresDisponibles) : 0;
    const maxProducible = Math.floor(factorMax * Number(rendimiento) * 100) / 100;

    return NextResponse.json({
      producto: { id: productoId, nombre, rendimiento: Number(rendimiento) },
      cantidadSolicitada: cantidadProducir,
      maxProducible,
      puedeProducir: necesidades.every((n) => n.ok),
      necesidades,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

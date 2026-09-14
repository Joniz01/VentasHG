import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type NecesidadInsumo = {
  insumoId: number;
  nombre: string;
  unidadMedida: string;
  necesario: number;   // cantidad bruta con merma acumulada
  disponible: number;
  deficit: number;
  ok: boolean;
  nivel: number;       // profundidad en el árbol de explosión
};

// Explosión recursiva multi-nivel
// Acumula necesidades de MATERIA_PRIMA sumando cantidades de todos los caminos
async function explotar(
  productoId: number,
  cantidadNeta: number, // unidades netas del producto a producir
  nivelMax: number,
  nivel: number,
  acumulado: Map<number, NecesidadInsumo>,
  visitados: Set<number>
): Promise<void> {
  if (nivel > nivelMax) return; // prevenir recursión infinita

  const prod = await pool.query(
    `SELECT id, nombre, COALESCE(rp_rendimiento, 1) AS rendimiento,
            COALESCE(aprovisionamiento, 'COMPRA') AS aprovisionamiento
     FROM productos WHERE id = $1 AND activo = TRUE`,
    [productoId]
  );
  if (prod.rows.length === 0) return;

  const rendimiento = Number(prod.rows[0].rendimiento);
  const lotes = cantidadNeta / rendimiento;

  const items = await pool.query(
    `SELECT
       ri.insumo_id,
       p.nombre,
       COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
       p.stock_actual,
       COALESCE(p.aprovisionamiento, 'COMPRA') AS aprovisionamiento,
       ri.cantidad AS cantidad_por_lote,
       COALESCE(ri.factor_merma, 1.0) AS factor_merma
     FROM rp_items ri
     JOIN productos p ON p.id = ri.insumo_id
     WHERE ri.producto_id = $1 AND ri.activo = TRUE
     ORDER BY ri.orden ASC, p.nombre ASC`,
    [productoId]
  );

  for (const r of items.rows) {
    const insumoId = Number(r.insumo_id);
    const cantidadBruta = Number(r.cantidad_por_lote) * lotes * Number(r.factor_merma);
    const aprovisionamiento = String(r.aprovisionamiento);

    if (aprovisionamiento === "FABRICACION" && !visitados.has(insumoId)) {
      // Sub-receta: explotar hacia abajo (no consume stock propio, consume sus insumos)
      visitados.add(insumoId);
      await explotar(insumoId, cantidadBruta, nivelMax, nivel + 1, acumulado, visitados);
      visitados.delete(insumoId);
    } else {
      // Materia prima (o fallback): acumular necesidad
      const existing = acumulado.get(insumoId);
      if (existing) {
        existing.necesario += cantidadBruta;
        existing.deficit = Math.max(0, existing.necesario - existing.disponible);
        existing.ok = existing.deficit === 0;
      } else {
        const disponible = Number(r.stock_actual);
        const deficit = Math.max(0, cantidadBruta - disponible);
        acumulado.set(insumoId, {
          insumoId,
          nombre: String(r.nombre),
          unidadMedida: String(r.unidad_medida),
          necesario: cantidadBruta,
          disponible,
          deficit,
          ok: deficit === 0,
          nivel,
        });
      }
    }
  }
}

// POST: simular producción de N unidades de un producto (explosión multi-nivel)
// Body: { productoId: number, cantidad: number }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const productoId = Number(body.productoId);
  const cantidadProducir = Number(body.cantidad);

  if (!productoId || isNaN(cantidadProducir) || cantidadProducir <= 0) {
    return NextResponse.json({ error: "productoId y cantidad > 0 requeridos" }, { status: 400 });
  }

  try {
    const prodRes = await pool.query(
      `SELECT id, nombre, COALESCE(rp_rendimiento, 1) AS rendimiento
       FROM productos WHERE id = $1 AND activo = TRUE`,
      [productoId]
    );
    if (prodRes.rows.length === 0) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const { nombre, rendimiento } = prodRes.rows[0];

    const acumulado = new Map<number, NecesidadInsumo>();
    await explotar(productoId, cantidadProducir, 10, 1, acumulado, new Set([productoId]));

    const necesidades = Array.from(acumulado.values()).map((n) => ({
      ...n,
      necesario: Math.round(n.necesario * 1000) / 1000,
      deficit: Math.round(n.deficit * 1000) / 1000,
    }));

    // Máximo producible: mínimo factor disponible/necesario sobre todos los insumos
    const factorMax = necesidades.length > 0
      ? Math.min(...necesidades.map((n) => n.necesario > 0 ? n.disponible / n.necesario : Infinity))
      : 0;
    const maxProducible = Math.floor(factorMax * cantidadProducir * 100) / 100;

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

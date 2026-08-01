import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export type FiltroStock = "todos" | "cero" | "bajo_minimo" | "saludable" | "sin_alerta";

export async function GET(request: NextRequest) {
  const filtro = (request.nextUrl.searchParams.get("filtro") ?? "todos") as FiltroStock;

  try {
    let whereExtra = "";
    try {
      // Build filter clause — uses new columns (migration 046)
      switch (filtro) {
        case "cero":
          whereExtra = `AND NOT COALESCE(p.alerta_outstock_desactivada, FALSE) AND p.stock_actual <= 0`;
          break;
        case "bajo_minimo":
          whereExtra = `AND NOT COALESCE(p.alerta_outstock_desactivada, FALSE) AND p.stock_actual > 0 AND COALESCE(p.stock_minimo,0) > 0 AND p.stock_actual <= COALESCE(p.stock_minimo,0)`;
          break;
        case "saludable":
          whereExtra = `AND NOT COALESCE(p.alerta_outstock_desactivada, FALSE) AND p.stock_actual > 0 AND (COALESCE(p.stock_minimo,0) = 0 OR p.stock_actual > COALESCE(p.stock_minimo,0))`;
          break;
        case "sin_alerta":
          whereExtra = `AND COALESCE(p.alerta_outstock_desactivada, FALSE)`;
          break;
        default:
          whereExtra = "";
      }

      const result = await pool.query(`
        SELECT
          p.id, p.nombre, p.stock_actual,
          COALESCE(p.stock_minimo, 0)          AS stock_minimo,
          COALESCE(p.unidad_medida, 'unidad')  AS unidad_medida,
          COALESCE(p.alerta_outstock_desactivada, FALSE) AS alerta_outstock_desactivada,
          p.alerta_outstock_motivo,
          c.nombre AS categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.activo = TRUE AND p.tipo_producto = 'NORMAL'
          ${whereExtra}
        ORDER BY
          CASE
            WHEN NOT COALESCE(p.alerta_outstock_desactivada, FALSE) AND p.stock_actual <= 0                                                                              THEN 0
            WHEN NOT COALESCE(p.alerta_outstock_desactivada, FALSE) AND COALESCE(p.stock_minimo,0) > 0 AND p.stock_actual <= COALESCE(p.stock_minimo,0)                  THEN 1
            WHEN COALESCE(p.alerta_outstock_desactivada, FALSE)                                                                                                           THEN 3
            ELSE 2
          END,
          p.nombre ASC
      `);

      return NextResponse.json(
        result.rows.map(r => ({
          id:                       r.id,
          nombre:                   r.nombre,
          categoriaNombre:          r.categoria_nombre ?? null,
          stockActual:              Number(r.stock_actual),
          stockMinimo:              Number(r.stock_minimo),
          unidadMedida:             r.unidad_medida,
          alertaOutstockDesactivada: Boolean(r.alerta_outstock_desactivada),
          alertaOutstockMotivo:     r.alerta_outstock_motivo ?? null,
        }))
      );
    } catch {
      // Fallback — migration 046 not yet applied
      const result = await pool.query(`
        SELECT p.id, p.nombre, p.stock_actual, c.nombre AS categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.activo = TRUE AND p.tipo_producto = 'NORMAL'
        ORDER BY p.stock_actual ASC, p.nombre ASC
      `);
      return NextResponse.json(
        result.rows.map(r => ({
          id: r.id, nombre: r.nombre,
          categoriaNombre: r.categoria_nombre ?? null,
          stockActual: Number(r.stock_actual),
          stockMinimo: 0, unidadMedida: "unidad",
          alertaOutstockDesactivada: false, alertaOutstockMotivo: null,
        }))
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    // Tasa actual (más reciente)
    const tasaRes = await pool.query(`
      SELECT COALESCE(
        (SELECT tasa FROM tasas_bcv_historico ORDER BY fecha DESC, id DESC LIMIT 1),
        (SELECT tasa_dia FROM compras WHERE estado = 'ACTIVA' AND tasa_dia > 0 ORDER BY created_at DESC LIMIT 1),
        1
      ) AS tasa_actual
    `);
    const tasaActual = Number(tasaRes.rows[0].tasa_actual);

    // Costo promedio ponderado por producto (de compras activas)
    // CPP = SUM(cantidad * costo_unit_bs / tasa_dia) / SUM(cantidad) → costo en USD
    const result = await pool.query(`
      WITH costos AS (
        SELECT
          ci.producto_id,
          ci.nombre_producto,
          SUM(ci.cantidad)                                              AS total_comprado,
          SUM(ci.cantidad * ci.costo_unit_bs)                          AS total_bs,
          SUM(
            CASE WHEN c.tasa_dia > 0
              THEN ci.cantidad * (ci.costo_unit_bs / c.tasa_dia)
              ELSE 0
            END
          )                                                             AS total_usd
        FROM compra_items ci
        JOIN compras c ON c.id = ci.compra_id
        WHERE c.estado = 'ACTIVA'
          AND ci.producto_id IS NOT NULL
          AND COALESCE(ci.tipo_uso, 'INVENTARIO') != 'GASTO'
        GROUP BY ci.producto_id, ci.nombre_producto
      ),
      productos_stock AS (
        SELECT
          p.id,
          p.nombre,
          p.stock_actual,
          COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
          f.nombre AS categoria_nombre,
          COALESCE(f.orden, 99) AS cat_orden
        FROM productos p
        LEFT JOIN familias f ON f.id = p.categoria_id
        WHERE p.activo = TRUE
          AND p.stock_actual > 0
      )
      SELECT
        ps.id,
        ps.nombre,
        ps.stock_actual,
        ps.unidad_medida,
        ps.categoria_nombre,
        ps.cat_orden,
        COALESCE(c.total_bs, 0)                   AS total_comprado_bs,
        COALESCE(c.total_usd, 0)                  AS total_comprado_usd,
        COALESCE(c.total_comprado, 0)             AS qty_comprada,
        -- CPP en USD
        CASE WHEN COALESCE(c.total_comprado, 0) > 0
          THEN c.total_usd / c.total_comprado
          ELSE NULL
        END                                        AS costo_prom_usd,
        -- CPP en Bs (usando tasa actual para convertir)
        CASE WHEN COALESCE(c.total_comprado, 0) > 0
          THEN (c.total_usd / c.total_comprado) * $1
          ELSE NULL
        END                                        AS costo_prom_bs
      FROM productos_stock ps
      LEFT JOIN costos c ON c.producto_id = ps.id
      ORDER BY ps.cat_orden ASC, ps.categoria_nombre ASC NULLS LAST, ps.nombre ASC
    `, [tasaActual]);

    const rows = result.rows.map((r) => {
      const costoPromUsd = r.costo_prom_usd !== null ? Number(r.costo_prom_usd) : null;
      const costoPromBs  = r.costo_prom_bs  !== null ? Number(r.costo_prom_bs)  : null;
      const stockActual  = Number(r.stock_actual);
      return {
        id:              r.id,
        nombre:          r.nombre,
        stockActual,
        unidadMedida:    r.unidad_medida,
        categoriaNombre: r.categoria_nombre ?? null,
        costoPromUsd,
        costoPromBs,
        valorTotalUsd:   costoPromUsd !== null ? costoPromUsd * stockActual : null,
        valorTotalBs:    costoPromBs  !== null ? costoPromBs  * stockActual : null,
      };
    });

    const totalUsd = rows.reduce((s, r) => s + (r.valorTotalUsd ?? 0), 0);
    const totalBs  = rows.reduce((s, r) => s + (r.valorTotalBs  ?? 0), 0);

    return NextResponse.json({
      tasaActual,
      totalUsd,
      totalBs,
      productos: rows,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");

  try {
    let result;
    try {
      result = await pool.query(
        `SELECT
           im.id, im.producto_id, im.cantidad, im.nota, im.created_at,
           COALESCE(im.motivo_ajuste, 'OTRO') AS motivo_ajuste,
           COALESCE(im.origen, 'MANUAL')      AS origen,
           im.usuario_id,
           u.nombre  AS usuario_nombre,
           p.nombre  AS producto_nombre,
           p.stock_actual AS stock_actual,
           COALESCE(p.unidad_medida, 'unidad') AS unidad_medida
         FROM inventario_movimientos im
         JOIN productos p ON p.id = im.producto_id
         LEFT JOIN usuarios u ON u.id = im.usuario_id
         WHERE im.tipo = 'AJUSTE'
         ORDER BY im.created_at DESC, im.id DESC
         LIMIT $1`,
        [limit]
      );
    } catch {
      result = await pool.query(
        `SELECT
           im.id, im.producto_id, im.cantidad, im.nota, im.created_at,
           'OTRO' AS motivo_ajuste, 'MANUAL' AS origen,
           NULL AS usuario_id, NULL AS usuario_nombre,
           p.nombre AS producto_nombre,
           p.stock_actual AS stock_actual,
           COALESCE(p.unidad_medida, 'unidad') AS unidad_medida
         FROM inventario_movimientos im
         JOIN productos p ON p.id = im.producto_id
         WHERE im.tipo = 'AJUSTE'
         ORDER BY im.created_at DESC, im.id DESC
         LIMIT $1`,
        [limit]
      );
    }

    return NextResponse.json(
      result.rows.map((r) => ({
        id:              r.id,
        productoId:      r.producto_id,
        productoNombre:  r.producto_nombre,
        stockActual:     Number(r.stock_actual),
        unidadMedida:    r.unidad_medida,
        cantidad:        Number(r.cantidad),
        motivoAjuste:    r.motivo_ajuste,
        nota:            r.nota ?? null,
        usuarioNombre:   r.usuario_nombre ?? null,
        createdAt:       r.created_at,
      }))
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

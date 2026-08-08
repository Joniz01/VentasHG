import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getConteoFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getConteoFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT p.id, p.nombre, p.stock_actual,
            COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
            c.nombre AS categoria_nombre
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.activo = TRUE AND p.tipo_producto = 'NORMAL'
       AND COALESCE(p.alerta_outstock_desactivada, FALSE) = FALSE
     ORDER BY c.nombre ASC NULLS LAST, p.nombre ASC`
  );

  return NextResponse.json(
    result.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      stockSistema: Number(r.stock_actual),
      unidadMedida: r.unidad_medida,
      categoriaNombre: r.categoria_nombre ?? null,
    }))
  );
}

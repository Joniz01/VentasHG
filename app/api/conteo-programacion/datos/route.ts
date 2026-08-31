import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.programarConteo && !sesion.permisos.autorizarConteo)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const [cats, prods, users] = await Promise.all([
    pool.query(`SELECT id, nombre FROM categorias ORDER BY nombre ASC`),
    pool.query(
      `SELECT id, nombre, COALESCE(grupo, 'PARA_LA_VENTA') AS grupo
       FROM productos
       WHERE activo = TRUE
       ORDER BY nombre ASC`
    ),
    pool.query(`SELECT id, nombre FROM usuarios WHERE activo = TRUE ORDER BY nombre ASC`),
  ]);

  return NextResponse.json({
    categorias: cats.rows.map((r) => ({ id: r.id, nombre: r.nombre })),
    productos: prods.rows.map((r) => ({ id: r.id, nombre: r.nombre, grupo: r.grupo })),
    usuarios: users.rows.map((r) => ({ id: r.id, nombre: r.nombre })),
  });
}

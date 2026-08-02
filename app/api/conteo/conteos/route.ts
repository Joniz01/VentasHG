import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getConteoFromRequest, getSesionFromRequest } from "@/lib/auth";

// GET — lista de conteos (para supervisor)
export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT ci.id, ci.estado, ci.nota, ci.created_at, ci.updated_at,
            ci.nota_supervisor, ci.aprobado_at,
            cu.nombre AS conteo_usuario_nombre,
            u.nombre AS aprobado_por_nombre,
            COUNT(cii.id) AS total_items
     FROM conteo_inventario ci
     LEFT JOIN conteo_usuarios cu ON cu.id = ci.conteo_usuario_id
     LEFT JOIN usuarios u ON u.id = ci.aprobado_por
     LEFT JOIN conteo_inventario_items cii ON cii.conteo_id = ci.id
     GROUP BY ci.id, cu.nombre, u.nombre
     ORDER BY ci.created_at DESC`
  );

  return NextResponse.json(
    result.rows.map((r) => ({
      id: r.id,
      estado: r.estado,
      nota: r.nota,
      conteoUsuarioNombre: r.conteo_usuario_nombre ?? null,
      aprobadoPor: r.aprobado_por_nombre ?? null,
      aprobadoAt: r.aprobado_at ?? null,
      notaSupervisor: r.nota_supervisor ?? null,
      totalItems: Number(r.total_items),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
}

// POST — crear nuevo conteo en BORRADOR
export async function POST(request: NextRequest) {
  const sesion = await getConteoFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const nota = typeof body.nota === "string" ? body.nota.trim() || null : null;

  const result = await pool.query(
    `INSERT INTO conteo_inventario (conteo_usuario_id, nota)
     VALUES ($1, $2) RETURNING id`,
    [sesion.id, nota]
  );

  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}

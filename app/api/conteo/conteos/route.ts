import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getConteoFromRequest, getSesionFromRequest } from "@/lib/auth";

// DELETE — purgar conteos por ids o rango de fechas (requiere sesión principal)
export async function DELETE(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!sesion.permisos?.autorizarConteo && sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await request.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
  const desde: string | null = typeof body.desde === "string" ? body.desde : null;
  const hasta: string | null = typeof body.hasta === "string" ? body.hasta : null;

  if (ids.length === 0 && !desde && !hasta) {
    return NextResponse.json({ error: "Se requieren ids o rango de fechas" }, { status: 400 });
  }

  try {
    let deleted = 0;
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      const res = await pool.query(
        `DELETE FROM conteo_inventario WHERE id IN (${placeholders})`,
        ids
      );
      deleted = res.rowCount ?? 0;
    } else if (desde && hasta) {
      const res = await pool.query(
        `DELETE FROM conteo_inventario WHERE created_at >= $1 AND created_at < ($2::date + INTERVAL '1 day')`,
        [desde, hasta]
      );
      deleted = res.rowCount ?? 0;
    } else if (desde) {
      const res = await pool.query(
        `DELETE FROM conteo_inventario WHERE created_at >= $1`,
        [desde]
      );
      deleted = res.rowCount ?? 0;
    } else if (hasta) {
      const res = await pool.query(
        `DELETE FROM conteo_inventario WHERE created_at < ($1::date + INTERVAL '1 day')`,
        [hasta]
      );
      deleted = res.rowCount ?? 0;
    }
    return NextResponse.json({ deleted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

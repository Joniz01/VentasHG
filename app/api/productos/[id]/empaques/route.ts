import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const result = await pool.query(
      `SELECT pe.id, pe.empaque_id, p.nombre AS empaque_nombre,
              p.stock_actual AS empaque_stock, pe.rendimiento, pe.prioridad
       FROM producto_empaques pe
       JOIN productos p ON p.id = pe.empaque_id
       WHERE pe.unidad_id = $1 AND pe.activo = TRUE
       ORDER BY pe.prioridad ASC`,
      [id]
    );
    return NextResponse.json(result.rows.map((r) => ({
      id: r.id,
      empaqueId: r.empaque_id,
      empaqueNombre: r.empaque_nombre,
      empaqueStock: Number(r.empaque_stock),
      rendimiento: r.rendimiento,
      prioridad: r.prioridad,
    })));
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { empaqueId, rendimiento, prioridad } = body;

  if (!empaqueId || !rendimiento || Number(rendimiento) < 1) {
    return NextResponse.json({ error: "empaqueId y rendimiento son requeridos" }, { status: 400 });
  }
  if (Number(empaqueId) === Number(id)) {
    return NextResponse.json({ error: "El empaque no puede ser el mismo producto" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO producto_empaques (unidad_id, empaque_id, rendimiento, prioridad)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (unidad_id, empaque_id) DO UPDATE
       SET rendimiento = EXCLUDED.rendimiento, prioridad = EXCLUDED.prioridad, activo = TRUE
     RETURNING id`,
    [id, empaqueId, Number(rendimiento), Number(prioridad ?? 1)]
  );
  return NextResponse.json({ ok: true, id: result.rows[0].id }, { status: 201 });
}

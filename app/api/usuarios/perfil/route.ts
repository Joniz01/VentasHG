import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const result = await pool.query(
    `SELECT nombre, usuario, telefono, correo, ventas_modo_vista, ventas_orden_pasos
     FROM usuarios WHERE id = $1`,
    [sesion.id]
  );
  return NextResponse.json(result.rows[0] ?? {});
}

export async function PUT(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json()) as {
    telefono?: string;
    correo?: string;
    ventas_modo_vista?: string | null;
    ventas_orden_pasos?: string | null;
  };

  await pool.query(
    `UPDATE usuarios
     SET telefono = $1, correo = $2, ventas_modo_vista = $3, ventas_orden_pasos = $4
     WHERE id = $5`,
    [
      body.telefono?.trim() || null,
      body.correo?.trim() || null,
      body.ventas_modo_vista ?? null,
      body.ventas_orden_pasos ?? null,
      sesion.id,
    ]
  );
  return NextResponse.json({ ok: true });
}

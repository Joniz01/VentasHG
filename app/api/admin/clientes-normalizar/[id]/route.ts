import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const clienteId = Number(id);
  if (!clienteId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json();
  const { nombre, apellido } = body as { nombre: string; apellido?: string };

  if (!nombre?.trim()) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const normNombre = toTitleCase(nombre);
  const normApellido = apellido ? toTitleCase(apellido) : "";

  await pool.query(
    `UPDATE clientes
     SET nombre = $1, apellido = $2, normalizado = TRUE, normalizado_at = NOW(), normalizado_por = $3
     WHERE id = $4`,
    [normNombre, normApellido || null, sesion.id, clienteId]
  );

  return NextResponse.json({ ok: true, nombre: normNombre, apellido: normApellido || null });
}

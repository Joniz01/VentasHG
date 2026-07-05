import { NextRequest, NextResponse } from "next/server";
import { getSesionFromRequest } from "@/lib/auth";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return null;
  return sesion;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { is_active, quota_limit, key_label } = body;

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (is_active   !== undefined) { fields.push(`is_active = $${idx++}`);   values.push(Boolean(is_active)); }
  if (quota_limit !== undefined) { fields.push(`quota_limit = $${idx++}`); values.push(quota_limit === null ? null : Number(quota_limit)); }
  if (key_label   !== undefined) { fields.push(`key_label = $${idx++}`);   values.push(String(key_label).trim()); }

  if (!fields.length) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE llm_api_keys SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const result = await pool.query(
    `DELETE FROM llm_api_keys WHERE id = $1 RETURNING id`,
    [id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Key no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

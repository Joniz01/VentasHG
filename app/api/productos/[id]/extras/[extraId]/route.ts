import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string; extraId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, extraId } = await params;

  const result = await pool.query(
    `DELETE FROM producto_extras WHERE id = $1 AND producto_id = $2`,
    [extraId, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Extra no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string; componenteId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id, componenteId } = await params;

  const result = await pool.query(
    `DELETE FROM producto_componentes WHERE id = $1 AND producto_id = $2`,
    [componenteId, id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Componente no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

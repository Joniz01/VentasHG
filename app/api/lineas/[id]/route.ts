import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const lineaId = Number(id);

  if (!lineaId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Validar que no tenga productos asignados
  const prodResult = await pool.query(
    `SELECT COUNT(*) AS total FROM productos WHERE linea_id = $1 AND activo = TRUE`,
    [lineaId]
  );
  const totalProductos = Number(prodResult.rows[0]?.total ?? 0);
  if (totalProductos > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${totalProductos} producto(s) tienen esta línea asignada. Reasígnalos primero.` },
      { status: 409 }
    );
  }

  const result = await pool.query(`DELETE FROM lineas WHERE id = $1`, [lineaId]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Línea no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

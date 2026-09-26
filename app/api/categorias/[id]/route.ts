import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const familiaId = Number(id);

  if (!familiaId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Validar que no tenga líneas asociadas
  const lineasResult = await pool.query(
    `SELECT COUNT(*) AS total FROM lineas WHERE familia_id = $1 AND activo = TRUE`,
    [familiaId]
  );
  const totalLineas = Number(lineasResult.rows[0]?.total ?? 0);
  if (totalLineas > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: esta familia tiene ${totalLineas} línea(s) activa(s). Elimina primero las líneas.` },
      { status: 409 }
    );
  }

  // Validar que no tenga productos asignados directamente
  const prodResult = await pool.query(
    `SELECT COUNT(*) AS total FROM productos WHERE categoria_id = $1 AND activo = TRUE`,
    [familiaId]
  );
  const totalProductos = Number(prodResult.rows[0]?.total ?? 0);
  if (totalProductos > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${totalProductos} producto(s) tienen esta familia asignada. Reasígnalos primero.` },
      { status: 409 }
    );
  }

  const result = await pool.query(`DELETE FROM familias WHERE id = $1`, [familiaId]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Familia no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

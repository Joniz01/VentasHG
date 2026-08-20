import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const salidaId = Number(id);
  if (!salidaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar que exista y no esté ya anulada
    const salidaResult = await client.query(
      `SELECT id, anulada FROM salidas_gratuitas WHERE id = $1 FOR UPDATE`,
      [salidaId]
    );
    if ((salidaResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Salida no encontrada" }, { status: 404 });
    }
    if (salidaResult.rows[0].anulada) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Esta salida ya fue anulada" }, { status: 400 });
    }

    // Leer ítems para restaurar stock
    const itemsResult = await client.query(
      `SELECT producto_id, cantidad FROM salidas_gratuitas_items WHERE salida_id = $1`,
      [salidaId]
    );

    for (const item of itemsResult.rows) {
      // Restaurar stock
      await client.query(
        `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2`,
        [item.cantidad, item.producto_id]
      );

      // Registrar movimiento de reversión
      const nota = `Anulación salida gratuita #${salidaId}`;
      await client.query("SAVEPOINT antes_mov");
      try {
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
           VALUES ($1, 'AJUSTE', $2, $3, $4, 'ANULACION_SALIDA_GRATUITA')`,
          [item.producto_id, item.cantidad, nota, sesion.id]
        );
      } catch {
        await client.query("ROLLBACK TO SAVEPOINT antes_mov");
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
           VALUES ($1, 'AJUSTE', $2, $3)`,
          [item.producto_id, item.cantidad, nota]
        );
      }
    }

    // Marcar como anulada
    await client.query(
      `UPDATE salidas_gratuitas SET anulada = TRUE, anulada_at = NOW(), anulada_usuario_id = $1 WHERE id = $2`,
      [sesion.id, salidaId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al anular" }, { status: 500 });
  } finally {
    client.release();
  }
}

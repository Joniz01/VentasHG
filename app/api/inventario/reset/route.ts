import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productosResult = await client.query(
      `SELECT id, stock_actual FROM productos WHERE tipo_producto = 'NORMAL' AND activo = TRUE FOR UPDATE`
    );

    let actualizados = 0;

    for (const row of productosResult.rows) {
      const stockActual = Number(row.stock_actual);
      if (stockActual === 0) continue;

      const ajuste = -stockActual;

      await client.query(`UPDATE productos SET stock_actual = 0 WHERE id = $1`, [row.id]);

      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
         VALUES ($1, 'AJUSTE', $2, 'Inicialización de inventario — llevado a cero')`,
        [row.id, ajuste]
      );

      actualizados++;
    }

    await client.query("COMMIT");

    return NextResponse.json({ ok: true, actualizados });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al resetear el inventario";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

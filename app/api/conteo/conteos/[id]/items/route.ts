import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getConteoFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// POST — guardar (upsert) items de conteo
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const sesion = await getConteoFromRequest(request);
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const items: { productoId: number; stockSistema: number; stockContado: number; nota?: string }[] =
    body.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items es requerido" }, { status: 400 });
  }

  // Verify conteo belongs to this user and is still in BORRADOR
  const check = await pool.query(
    `SELECT id FROM conteo_inventario
     WHERE id = $1 AND conteo_usuario_id = $2 AND estado = 'BORRADOR'`,
    [id, sesion.id]
  );
  if (check.rowCount === 0) {
    return NextResponse.json({ error: "Conteo no disponible" }, { status: 409 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const item of items) {
      await client.query(
        `INSERT INTO conteo_inventario_items
           (conteo_id, producto_id, stock_sistema, stock_contado, nota)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (conteo_id, producto_id)
         DO UPDATE SET stock_contado = EXCLUDED.stock_contado,
                       stock_sistema = EXCLUDED.stock_sistema,
                       nota = EXCLUDED.nota`,
        [id, item.productoId, item.stockSistema, item.stockContado, item.nota ?? null]
      );
    }

    await client.query(
      `UPDATE conteo_inventario SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : "Error al guardar";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    client.release();
  }
}

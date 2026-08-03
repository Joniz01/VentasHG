import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { unidadId, empaqueRelId } = body;

  if (!unidadId || !empaqueRelId) {
    return NextResponse.json({ error: "unidadId y empaqueRelId son requeridos" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const relResult = await client.query(
      `SELECT pe.empaque_id, pe.rendimiento,
              p.stock_actual AS empaque_stock, p.nombre AS empaque_nombre
       FROM producto_empaques pe
       JOIN productos p ON p.id = pe.empaque_id
       WHERE pe.id = $1 AND pe.unidad_id = $2 AND pe.activo = TRUE
       FOR UPDATE`,
      [empaqueRelId, unidadId]
    );

    if ((relResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Relación de empaque no encontrada" }, { status: 404 });
    }

    const rel = relResult.rows[0];
    if (Number(rel.empaque_stock) < 1) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Sin stock en el empaque seleccionado" }, { status: 400 });
    }

    const rendimiento: number = rel.rendimiento;

    await client.query(
      `UPDATE productos SET stock_actual = stock_actual - 1 WHERE id = $1`,
      [rel.empaque_id]
    );
    await client.query(
      `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2`,
      [rendimiento, unidadId]
    );

    const notaEmpaque = `Apertura de empaque "${rel.empaque_nombre}": generó ${rendimiento} unidades`;
    const notaUnidad = `Generado desde apertura de empaque "${rel.empaque_nombre}"`;

    try {
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
         VALUES ($1, 'AJUSTE', -1, $2, $3, 'APERTURA_EMPAQUE')`,
        [rel.empaque_id, notaEmpaque, sesion.id]
      );
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
         VALUES ($1, 'ENTRADA', $2, $3, $4, 'APERTURA_EMPAQUE')`,
        [unidadId, rendimiento, notaUnidad, sesion.id]
      );
    } catch {
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
         VALUES ($1, 'AJUSTE', -1, $2)`,
        [rel.empaque_id, notaEmpaque]
      );
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
         VALUES ($1, 'ENTRADA', $2, $3)`,
        [unidadId, rendimiento, notaUnidad]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, rendimiento, empaqueId: rel.empaque_id });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al abrir empaque" }, { status: 500 });
  } finally {
    client.release();
  }
}

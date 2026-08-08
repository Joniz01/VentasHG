import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  // empaqueRelId: id del registro en producto_empaques
  // unidadesAUsar: cuántas unidades del producto base se consumen
  const { empaqueRelId, unidadesAUsar } = body;

  if (!empaqueRelId || !unidadesAUsar || Number(unidadesAUsar) < 1) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const unidadesNum = Number(unidadesAUsar);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const relResult = await client.query(
      `SELECT pe.unidad_id, pe.empaque_id, pe.rendimiento,
              pu.stock_actual AS unidad_stock, pu.nombre AS unidad_nombre,
              pe2.stock_actual AS empaque_stock, pe2.nombre AS empaque_nombre
       FROM producto_empaques pe
       JOIN productos pu  ON pu.id  = pe.unidad_id
       JOIN productos pe2 ON pe2.id = pe.empaque_id
       WHERE pe.id = $1 AND pe.activo = TRUE
       FOR UPDATE`,
      [empaqueRelId]
    );

    if ((relResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Relación de empaque no encontrada" }, { status: 404 });
    }

    const rel = relResult.rows[0];
    const rendimiento: number = Number(rel.rendimiento);
    const unidadStock: number = Number(rel.unidad_stock);

    if (unidadesNum > unidadStock) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Stock insuficiente. Solo hay ${unidadStock} unidades de "${rel.unidad_nombre}"` },
        { status: 400 }
      );
    }

    if (unidadesNum % rendimiento !== 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: `Las unidades deben ser múltiplo de ${rendimiento} (rendimiento por empaque)` },
        { status: 400 }
      );
    }

    const empaquesGenerados = Math.floor(unidadesNum / rendimiento);

    await client.query(
      `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2`,
      [unidadesNum, rel.unidad_id]
    );
    await client.query(
      `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2`,
      [empaquesGenerados, rel.empaque_id]
    );

    const notaUnidad = `Armado de empaque "${rel.empaque_nombre}": se usaron ${unidadesNum} unidades`;
    const notaEmpaque = `Armado desde ${unidadesNum} unidades de "${rel.unidad_nombre}"`;

    await client.query("SAVEPOINT antes_movimientos");
    try {
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
         VALUES ($1, 'AJUSTE', $2, $3, $4, 'ARMADO_EMPAQUE')`,
        [rel.unidad_id, -unidadesNum, notaUnidad, sesion.id]
      );
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
         VALUES ($1, 'ENTRADA', $2, $3, $4, 'ARMADO_EMPAQUE')`,
        [rel.empaque_id, empaquesGenerados, notaEmpaque, sesion.id]
      );
    } catch {
      await client.query("ROLLBACK TO SAVEPOINT antes_movimientos");
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
         VALUES ($1, 'AJUSTE', $2, $3)`,
        [rel.unidad_id, -unidadesNum, notaUnidad]
      );
      await client.query(
        `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
         VALUES ($1, 'ENTRADA', $2, $3)`,
        [rel.empaque_id, empaquesGenerados, notaEmpaque]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      empaquesGenerados,
      unidadesUsadas: unidadesNum,
      unidadId: rel.unidad_id,
      empaqueId: rel.empaque_id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al armar empaque" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

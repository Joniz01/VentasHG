import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ordenId = Number(id);

  try {
    const [ordenRes, consumosRes] = await Promise.all([
      pool.query(`
        SELECT op.id, op.producto_id, op.estado, op.cantidad_planificada, op.cantidad_producida,
               op.fecha_planificada, op.fecha_inicio, op.fecha_fin, op.notas, op.created_at,
               p.nombre AS producto_nombre, COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
               p.stock_actual AS producto_stock
        FROM ordenes_produccion op
        JOIN productos p ON p.id = op.producto_id
        WHERE op.id = $1
      `, [ordenId]),
      pool.query(`
        SELECT oc.id, oc.insumo_id, oc.cantidad_planificada, oc.cantidad_consumida,
               p.nombre AS insumo_nombre, COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
               p.stock_actual
        FROM op_consumos oc
        JOIN productos p ON p.id = oc.insumo_id
        WHERE oc.orden_id = $1
        ORDER BY p.nombre ASC
      `, [ordenId]),
    ]);

    if (ordenRes.rows.length === 0) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    const orden = ordenRes.rows[0];
    const consumos = consumosRes.rows.map(r => ({
      id: r.id,
      insumoId: Number(r.insumo_id),
      insumoNombre: r.insumo_nombre,
      unidadMedida: r.unidad_medida,
      cantidadPlanificada: Number(r.cantidad_planificada),
      cantidadConsumida: Number(r.cantidad_consumida),
      stockActual: Number(r.stock_actual),
      deficit: Math.max(0, Number(r.cantidad_planificada) - Number(r.stock_actual)),
      ok: Number(r.stock_actual) >= Number(r.cantidad_planificada),
    }));

    return NextResponse.json({
      orden: {
        id: orden.id,
        productoId: Number(orden.producto_id),
        productoNombre: orden.producto_nombre,
        unidadMedida: orden.unidad_medida,
        productoStock: Number(orden.producto_stock),
        estado: orden.estado,
        cantidadPlanificada: Number(orden.cantidad_planificada),
        cantidadProducida: Number(orden.cantidad_producida),
        fechaPlanificada: orden.fecha_planificada,
        fechaInicio: orden.fecha_inicio,
        fechaFin: orden.fecha_fin,
        notas: orden.notas,
        createdAt: orden.created_at,
      },
      consumos,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ordenId = Number(id);
  const body = await req.json();
  const accion = String(body.accion ?? "");

  if (!["iniciar", "completar", "cancelar"].includes(accion)) {
    return NextResponse.json({ error: "accion inválida: iniciar | completar | cancelar" }, { status: 400 });
  }

  try {
    const ordenRes = await pool.query(
      `SELECT id, estado, producto_id, cantidad_planificada FROM ordenes_produccion WHERE id = $1`,
      [ordenId]
    );
    if (ordenRes.rows.length === 0) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    const orden = ordenRes.rows[0];
    const estado = String(orden.estado);

    if (accion === "iniciar") {
      if (estado !== "PENDIENTE") return NextResponse.json({ error: "Solo se puede iniciar una orden PENDIENTE" }, { status: 400 });
      await pool.query(
        `UPDATE ordenes_produccion SET estado = 'EN_PROCESO', fecha_inicio = now(), updated_at = now() WHERE id = $1`,
        [ordenId]
      );

    } else if (accion === "cancelar") {
      if (estado === "COMPLETADA") return NextResponse.json({ error: "No se puede cancelar una orden completada" }, { status: 400 });
      await pool.query(
        `UPDATE ordenes_produccion SET estado = 'CANCELADA', updated_at = now() WHERE id = $1`,
        [ordenId]
      );

    } else if (accion === "completar") {
      if (!["PENDIENTE", "EN_PROCESO"].includes(estado)) {
        return NextResponse.json({ error: "Solo se puede completar una orden PENDIENTE o EN_PROCESO" }, { status: 400 });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const consumos = await client.query(
          `SELECT insumo_id, cantidad_planificada FROM op_consumos WHERE orden_id = $1`,
          [ordenId]
        );

        // Deduct insumos from stock
        for (const c of consumos.rows) {
          await client.query(
            `UPDATE productos SET stock_actual = stock_actual - $1, updated_at = now() WHERE id = $2`,
            [Number(c.cantidad_planificada), Number(c.insumo_id)]
          );
          await client.query(
            `UPDATE op_consumos SET cantidad_consumida = cantidad_planificada WHERE orden_id = $1 AND insumo_id = $2`,
            [ordenId, Number(c.insumo_id)]
          );
          // Register consumption movement
          try {
            await client.query(
              `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, origen)
               VALUES ($1, 'SALIDA', $2, $3, 'PRODUCCION')`,
              [Number(c.insumo_id), Number(c.cantidad_planificada), `OP-${ordenId}`]
            );
          } catch { /* movimientos table may have different schema */ }
        }

        // Add finished product to stock
        const cantProducida = Number(orden.cantidad_planificada);
        await client.query(
          `UPDATE productos SET stock_actual = stock_actual + $1, updated_at = now() WHERE id = $2`,
          [cantProducida, Number(orden.producto_id)]
        );
        try {
          await client.query(
            `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, origen)
             VALUES ($1, 'ENTRADA', $2, $3, 'PRODUCCION')`,
            [Number(orden.producto_id), cantProducida, `OP-${ordenId}`]
          );
        } catch { /* ignore */ }

        await client.query(
          `UPDATE ordenes_produccion SET estado = 'COMPLETADA', fecha_fin = now(),
           cantidad_producida = $1, updated_at = now() WHERE id = $2`,
          [cantProducida, ordenId]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

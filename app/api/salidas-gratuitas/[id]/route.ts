import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const salidaId = Number(id);
  if (!salidaId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await request.json();
  const { tipo, fecha, beneficiario, motivo, items } = body as {
    tipo: string;
    fecha: string;
    beneficiario?: string;
    motivo?: string;
    items: { productoId: string; cantidad: string }[];
  };

  const tiposBase = ["CORTESIA", "SORTEO", "CONSUMO_INTERNO", "MUESTRA", "EVENTO", "FIDELIDAD"];
  const cfgRow = await pool.query(`SELECT valor FROM configuracion WHERE clave = 'salidas_tipos_extra'`);
  const tiposExtra = cfgRow.rows[0]?.valor ? cfgRow.rows[0].valor.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
  const tiposValidos = [...tiposBase, ...tiposExtra];
  if (!tiposValidos.includes(tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  if (!fecha) return NextResponse.json({ error: "La fecha es requerida" }, { status: 400 });
  const itemsValidos = (items ?? []).filter((i) => i.productoId && Number(i.cantidad) > 0);
  if (!itemsValidos.length) return NextResponse.json({ error: "Debe incluir al menos un producto" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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
      return NextResponse.json({ error: "No se puede editar una salida anulada" }, { status: 400 });
    }

    // Restaurar stock de los ítems anteriores
    const oldItems = await client.query(
      `SELECT producto_id, cantidad FROM salidas_gratuitas_items WHERE salida_id = $1`,
      [salidaId]
    );
    for (const old of oldItems.rows) {
      await client.query(
        `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2`,
        [old.cantidad, old.producto_id]
      );
    }

    // Eliminar ítems anteriores
    await client.query(`DELETE FROM salidas_gratuitas_items WHERE salida_id = $1`, [salidaId]);

    // Insertar nuevos ítems y descontar stock
    for (const item of itemsValidos) {
      const productoId = Number(item.productoId);
      const cantidad = Number(item.cantidad);

      const prodResult = await client.query(
        `SELECT stock_actual, costo, nombre FROM productos WHERE id = $1 FOR UPDATE`,
        [productoId]
      );
      if ((prodResult.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: `Producto ID ${productoId} no encontrado` }, { status: 400 });
      }
      const prod = prodResult.rows[0];
      if (Number(prod.stock_actual) < cantidad) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: `Stock insuficiente para "${prod.nombre}": disponible ${prod.stock_actual}, solicitado ${cantidad}` }, { status: 400 });
      }

      await client.query(
        `INSERT INTO salidas_gratuitas_items (salida_id, producto_id, cantidad, costo) VALUES ($1, $2, $3, $4)`,
        [salidaId, productoId, cantidad, prod.costo]
      );
      await client.query(
        `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2`,
        [cantidad, productoId]
      );

      const nota = `Edición salida gratuita #${salidaId} — ${tipo}${beneficiario ? ` — ${beneficiario}` : ""}`;
      await client.query("SAVEPOINT antes_mov");
      try {
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
           VALUES ($1, 'AJUSTE', $2, $3, $4, 'SALIDA_GRATUITA')`,
          [productoId, -cantidad, nota, sesion.id]
        );
      } catch {
        await client.query("ROLLBACK TO SAVEPOINT antes_mov");
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
           VALUES ($1, 'AJUSTE', $2, $3)`,
          [productoId, -cantidad, nota]
        );
      }
    }

    // Actualizar cabecera
    await client.query(
      `UPDATE salidas_gratuitas SET tipo = $1, fecha = $2, beneficiario = $3, motivo = $4 WHERE id = $5`,
      [tipo, fecha, beneficiario || null, motivo || null, salidaId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, salidaId });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al editar" }, { status: 500 });
  } finally {
    client.release();
  }
}

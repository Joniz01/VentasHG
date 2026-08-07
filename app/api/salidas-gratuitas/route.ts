import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const { tipo, fecha, beneficiario, motivo, items } = body as {
    tipo: string;
    fecha: string;
    beneficiario?: string;
    motivo?: string;
    items: { productoId: string; cantidad: string }[];
  };

  const tiposValidos = ["CORTESIA", "SORTEO", "MUESTRA", "EVENTO", "FIDELIDAD"];
  if (!tiposValidos.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de salida inválido" }, { status: 400 });
  }
  if (!fecha) {
    return NextResponse.json({ error: "La fecha es requerida" }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Debe incluir al menos un producto" }, { status: 400 });
  }
  const itemsValidos = items.filter((i) => i.productoId && Number(i.cantidad) > 0);
  if (!itemsValidos.length) {
    return NextResponse.json({ error: "Los productos deben tener cantidad mayor a 0" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Insertar cabecera de salida gratuita
    const salidaResult = await client.query(
      `INSERT INTO salidas_gratuitas (tipo, fecha, beneficiario, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tipo, fecha, beneficiario || null, motivo || null, sesion.id]
    );
    const salidaId: number = salidaResult.rows[0].id;

    for (const item of itemsValidos) {
      const productoId = Number(item.productoId);
      const cantidad = Number(item.cantidad);

      // Leer costo y verificar stock
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

      // Insertar ítem de salida
      await client.query(
        `INSERT INTO salidas_gratuitas_items (salida_id, producto_id, cantidad, costo)
         VALUES ($1, $2, $3, $4)`,
        [salidaId, productoId, cantidad, prod.costo]
      );

      // Descontar stock
      await client.query(
        `UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2`,
        [cantidad, productoId]
      );

      // Registrar movimiento de inventario
      const nota = `Salida gratuita #${salidaId} — ${tipo}${beneficiario ? ` — ${beneficiario}` : ""}`;
      await client.query("SAVEPOINT antes_mov");
      try {
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id, origen)
           VALUES ($1, 'SALIDA', $2, $3, $4, 'SALIDA_GRATUITA')`,
          [productoId, -cantidad, nota, sesion.id]
        );
      } catch {
        await client.query("ROLLBACK TO SAVEPOINT antes_mov");
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
           VALUES ($1, 'SALIDA', $2, $3)`,
          [productoId, -cantidad, nota]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, salidaId });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al registrar la salida" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get("tipo");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (tipo) { params.push(tipo); conditions.push(`sg.tipo = $${params.length}`); }
  if (desde) { params.push(desde); conditions.push(`sg.fecha >= $${params.length}`); }
  if (hasta) { params.push(hasta); conditions.push(`sg.fecha <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `SELECT sg.id, sg.tipo, sg.fecha, sg.beneficiario, sg.motivo, sg.created_at,
            u.nombre AS responsable,
            json_agg(json_build_object(
              'productoId', sgi.producto_id,
              'nombre', p.nombre,
              'cantidad', sgi.cantidad,
              'costoUnit', sgi.costo
            ) ORDER BY sgi.id) AS items
     FROM salidas_gratuitas sg
     LEFT JOIN usuarios u ON u.id = sg.usuario_id
     JOIN salidas_gratuitas_items sgi ON sgi.salida_id = sg.id
     JOIN productos p ON p.id = sgi.producto_id
     ${where}
     GROUP BY sg.id, u.nombre
     ORDER BY sg.fecha DESC, sg.id DESC`,
    params
  );

  return NextResponse.json(result.rows);
}

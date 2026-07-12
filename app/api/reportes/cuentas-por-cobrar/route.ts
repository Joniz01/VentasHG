import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const cobrada = searchParams.get("cobrada");
  const ventaId = searchParams.get("ventaId");
  const cliente = searchParams.get("cliente");

  const conditions: string[] = ["v.cuenta_por_cobrar = TRUE"];
  const params: unknown[] = [];

  if (desde) {
    params.push(desde);
    conditions.push(`v.fecha >= $${params.length}`);
  }

  if (hasta) {
    params.push(hasta);
    conditions.push(`v.fecha <= $${params.length}`);
  }

  if (cobrada === "COBRADA") {
    conditions.push("v.cuenta_cobrada = TRUE");
  } else if (cobrada === "PENDIENTE") {
    conditions.push("v.cuenta_cobrada = FALSE");
  }

  if (ventaId) {
    const ventaIdNum = Number(ventaId);
    if (!Number.isNaN(ventaIdNum)) {
      params.push(ventaIdNum);
      conditions.push(`v.id = $${params.length}`);
    }
  }

  if (cliente) {
    params.push(`%${cliente}%`);
    conditions.push(`v.cliente ILIKE $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT v.id, v.fecha, v.cliente, v.cliente_ci, v.cliente_telefono, v.tasa_dia,
              v.fecha_limite_pago, v.cuenta_cobrada, v.cuenta_cobrada_at,
              v.alarma_vencimiento_silenciada_hasta,
              COALESCE(v.costo_delivery, 0) AS costo_delivery,
              COALESCE(SUM(vi.precio_unit * vi.cantidad), 0) AS subtotal_items,
              BOOL_OR(pv.metodo = 'CASHEA') AS tiene_cashea,
              BOOL_OR(pv.metodo = 'YUMMY')  AS tiene_yummy
       FROM ventas v
       LEFT JOIN venta_items vi  ON vi.venta_id  = v.id
       LEFT JOIN pagos_venta pv ON pv.venta_id = v.id
       WHERE ${conditions.join(" AND ")}
       GROUP BY v.id
       ORDER BY v.fecha DESC, v.id DESC`,
      params
    );

    const items = result.rows.map((row) => {
      const subtotal = Number(row.subtotal_items);
      const delivery = Number(row.costo_delivery);
      const totalUsd = subtotal + delivery;
      const tasa = Number(row.tasa_dia);
      const tipoCxC: "CASHEA" | "YUMMY" | "CxC Directa" =
        row.tiene_cashea ? "CASHEA" : row.tiene_yummy ? "YUMMY" : "CxC Directa";
      return {
        ventaId: row.id,
        fecha: row.fecha,
        cliente: row.cliente,
        clienteCi: row.cliente_ci,
        clienteTelefono: row.cliente_telefono,
        totalUsd,
        totalBs: totalUsd * tasa,
        fechaLimitePago: row.fecha_limite_pago,
        cuentaCobrada: row.cuenta_cobrada,
        cuentaCobradaAt: row.cuenta_cobrada_at,
        alarmaSilenciadaHasta: row.alarma_vencimiento_silenciada_hasta,
        tipoCxC,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("CxC GET error:", err);
    return NextResponse.json(
      { error: "Error al consultar las cuentas por cobrar" },
      { status: 500 }
    );
  }
}

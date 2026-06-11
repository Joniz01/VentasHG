import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { insertarItemsYPagos, validarVenta, type VentaBody } from "@/lib/ventas";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as VentaBody;

  const error = validarVenta(body);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ventaResult = await client.query(
      `UPDATE ventas
       SET fecha = $1, tasa_dia = $2, cliente = $3, cliente_ci = $4, direccion = $5,
           modalidad_compra = $6, modo_entrega = $7, costo_delivery = $8, observaciones = $9
       WHERE id = $10
       RETURNING id`,
      [
        body.fecha,
        Number(body.tasaDelDia),
        body.cliente,
        body.clienteCi || null,
        body.direccion || null,
        body.modalidadCompra || null,
        body.modoEntrega || "LOCAL",
        Number(body.costoDelivery),
        body.observaciones || null,
        id,
      ]
    );

    if (ventaResult.rowCount === 0) {
      throw new Error("Venta no encontrada");
    }

    await client.query(`DELETE FROM venta_items WHERE venta_id = $1`, [id]);
    await client.query(`DELETE FROM pagos_venta WHERE venta_id = $1`, [id]);

    await insertarItemsYPagos(client, Number(id), body);

    await client.query("COMMIT");

    return NextResponse.json({ id: Number(id) });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al actualizar la venta";
    const status = message === "Venta no encontrada" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await pool.query(`DELETE FROM ventas WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

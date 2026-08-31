import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as {
    accion?: "pagar" | "pago_parcial" | "editar";
    montoPagadoBs?: number;
    montoPagadoUsd?: number;
    tasaDia?: number;
    nuevaFechVenc?: string;
    nota?: string;
    comprobanteUrl?: string;
    // campos editables
    proveedor?: string;
    proveedorRif?: string;
    numeroFactura?: string;
    descripcion?: string;
    fechaEmision?: string;
    fechaVencimiento?: string;
    montoBs?: number;
    montoUsd?: number;
    notas?: string;
    estado?: string;
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (body.accion === "pagar") {
      await client.query(
        `UPDATE cuentas_pagar SET estado = 'PAGADO', pagado_at = NOW(), comprobante_url = COALESCE($2, comprobante_url) WHERE id = $1`,
        [id, body.comprobanteUrl ?? null]
      );

    } else if (body.accion === "pago_parcial") {
      const cpResult = await client.query(`SELECT monto_bs, monto_usd, monto_original_bs FROM cuentas_pagar WHERE id = $1 FOR UPDATE`, [id]);
      if (!cpResult.rows.length) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
      }
      const cp = cpResult.rows[0];
      const montoBsActual = Number(cp.monto_bs);
      const montoOriginalBs = cp.monto_original_bs ? Number(cp.monto_original_bs) : montoBsActual;
      const montoPagadoBs = Number(body.montoPagadoBs) || 0;
      const montoPagadoUsd = Number(body.montoPagadoUsd) || 0;
      const tasaDia = Number(body.tasaDia) || 0;
      const restanteBs = montoBsActual - montoPagadoBs;

      if (restanteBs < 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "El monto pagado supera el saldo pendiente" }, { status: 400 });
      }

      const nuevaFechVenc = body.nuevaFechVenc || null;

      await client.query(
        `UPDATE cuentas_pagar SET
           monto_bs = $2,
           monto_usd = CASE WHEN $5 > 0 THEN $2 / $5 ELSE monto_usd END,
           monto_original_bs = COALESCE($3, monto_original_bs),
           monto_pagado_bs = COALESCE(monto_pagado_bs, 0) + $4,
           estado = CASE WHEN $2 <= 0 THEN 'PAGADO' ELSE 'PENDIENTE_PARCIAL' END,
           fecha_vencimiento = COALESCE($6::date, fecha_vencimiento),
           pagado_at = CASE WHEN $2 <= 0 THEN NOW() ELSE NULL END
         WHERE id = $1`,
        [id, restanteBs, montoOriginalBs, montoPagadoBs, tasaDia, nuevaFechVenc]
      );

      await client.query(
        `INSERT INTO cuentas_pagar_historial (cuenta_pagar_id, fecha_pago, monto_bs, monto_usd, tasa_dia, nota)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
        [id, montoPagadoBs, montoPagadoUsd, tasaDia, body.nota ?? null]
      );

    } else {
      // editar campos
      const sets: string[] = [];
      const vals: unknown[] = [id];
      const add = (col: string, val: unknown) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
      if (body.proveedor !== undefined) add("proveedor", body.proveedor.trim());
      if (body.proveedorRif !== undefined) add("proveedor_rif", body.proveedorRif?.trim() || null);
      if (body.numeroFactura !== undefined) add("numero_factura", body.numeroFactura?.trim() || null);
      if (body.descripcion !== undefined) add("descripcion", body.descripcion?.trim() || null);
      if (body.fechaEmision !== undefined) add("fecha_emision", body.fechaEmision);
      if (body.fechaVencimiento !== undefined) add("fecha_vencimiento", body.fechaVencimiento);
      if (body.montoBs !== undefined) add("monto_bs", Number(body.montoBs));
      if (body.montoUsd !== undefined) add("monto_usd", Number(body.montoUsd));
      if (body.notas !== undefined) add("notas", body.notas?.trim() || null);
      if (body.estado !== undefined) add("estado", body.estado);
      if (sets.length) await client.query(`UPDATE cuentas_pagar SET ${sets.join(", ")} WHERE id = $1`, vals);
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error al actualizar cuenta por pagar", detalle }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const histCount = await pool.query(`SELECT COUNT(*) AS n FROM cuentas_pagar_historial WHERE cuenta_pagar_id = $1`, [id]);
    if (Number(histCount.rows[0]?.n) > 0) {
      return NextResponse.json({ error: "No se puede eliminar: tiene abonos registrados" }, { status: 409 });
    }
    await pool.query(`DELETE FROM cuentas_pagar WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Error al eliminar", detalle }, { status: 500 });
  }
}

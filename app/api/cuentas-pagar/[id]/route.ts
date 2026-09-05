import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

const DIAS_FRECUENCIA: Record<string, number> = { SEMANAL: 7, QUINCENAL: 15, MENSUAL: 30 };

function calcularProximoVencimiento(base: string, frecuencia: string): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + (DIAS_FRECUENCIA[frecuencia] ?? 30));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as {
    accion?: "pagar" | "pago_parcial" | "editar" | "revertir_ultimo_abono";
    montoPagadoBs?: number;
    montoPagadoUsd?: number;
    tasaDia?: number;
    fechaPago?: string;
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
      // Leer antes de marcar pagado para saber si es recurrente
      const cpRead = await client.query(
        `SELECT proveedor, proveedor_rif, numero_factura, descripcion, fecha_vencimiento,
                monto_bs, monto_usd, tasa_dia, notas, recurrente, frecuencia, created_by
         FROM cuentas_pagar WHERE id = $1`,
        [id]
      );
      const cp = cpRead.rows[0];

      const tasaDiaPago = Number(body.tasaDia) || null;
      const fechaPagoParam = body.fechaPago ?? null;
      await client.query(
        `UPDATE cuentas_pagar
         SET estado = 'PAGADO',
             pagado_at = COALESCE($2::date, NOW()),
             tasa_dia = COALESCE($3, tasa_dia),
             comprobante_url = COALESCE($4, comprobante_url)
         WHERE id = $1`,
        [id, fechaPagoParam, tasaDiaPago, body.comprobanteUrl ?? null]
      );

      // Si es recurrente, generar el siguiente período automáticamente
      if (cp?.recurrente && cp?.frecuencia) {
        const baseVenc = cp.fecha_vencimiento instanceof Date
          ? cp.fecha_vencimiento.toISOString().slice(0, 10)
          : String(cp.fecha_vencimiento).slice(0, 10);
        const nuevoVenc = calcularProximoVencimiento(baseVenc, String(cp.frecuencia));
        const nuevoProxVenc = calcularProximoVencimiento(nuevoVenc, String(cp.frecuencia));
        await client.query(
          `INSERT INTO cuentas_pagar
            (proveedor, proveedor_rif, numero_factura, descripcion, fecha_emision, fecha_vencimiento,
             monto_bs, monto_usd, tasa_dia, estado, notas, recurrente, frecuencia, proximo_vencimiento, created_by)
           VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,$6,$7,$8,'PENDIENTE',$9,true,$10,$11,$12)`,
          [
            cp.proveedor, cp.proveedor_rif, cp.numero_factura, cp.descripcion,
            nuevoVenc, cp.monto_bs, cp.monto_usd, cp.tasa_dia, cp.notas,
            cp.frecuencia, nuevoProxVenc, cp.created_by,
          ]
        );
      }

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

      // Usar SAVEPOINT para poder reintentar si fallan columnas opcionales
      await client.query("SAVEPOINT sp_update");
      try {
        await client.query(
          `UPDATE cuentas_pagar SET
             monto_bs = $2::numeric,
             monto_usd = GREATEST(monto_usd - $3::numeric, 0),
             monto_original_bs = COALESCE($4::numeric, monto_original_bs),
             monto_pagado_bs = COALESCE(monto_pagado_bs, 0) + $5::numeric,
             estado = CASE WHEN $2::numeric <= 0 THEN 'PAGADO' ELSE 'PENDIENTE_PARCIAL' END,
             fecha_vencimiento = COALESCE($6::date, fecha_vencimiento),
             pagado_at = CASE WHEN $2::numeric <= 0 THEN NOW() ELSE NULL END
           WHERE id = $1`,
          [id, restanteBs, montoPagadoUsd, montoOriginalBs, montoPagadoBs, nuevaFechVenc]
        );
        await client.query("RELEASE SAVEPOINT sp_update");
      } catch {
        // Columnas opcionales no existen — rollback al savepoint y fallback
        await client.query("ROLLBACK TO SAVEPOINT sp_update");
        await client.query(
          `UPDATE cuentas_pagar SET
             monto_bs = $2::numeric,
             monto_usd = GREATEST(monto_usd - $3::numeric, 0),
             estado = CASE WHEN $2::numeric <= 0 THEN 'PAGADO' ELSE 'PENDIENTE_PARCIAL' END,
             fecha_vencimiento = COALESCE($4::date, fecha_vencimiento),
             pagado_at = CASE WHEN $2::numeric <= 0 THEN NOW() ELSE NULL END
           WHERE id = $1`,
          [id, restanteBs, montoPagadoUsd, nuevaFechVenc]
        );
      }

      await client.query("SAVEPOINT sp_historial");
      try {
        const fpHistorial = body.fechaPago || null;
        await client.query(
          `INSERT INTO cuentas_pagar_historial (cuenta_pagar_id, fecha_pago, monto_bs, monto_usd, tasa_dia, nota)
           VALUES ($1, COALESCE($6::date, CURRENT_DATE), $2, $3, $4, $5)`,
          [id, montoPagadoBs, montoPagadoUsd, tasaDia, body.nota ?? null, fpHistorial]
        );
      } catch { await client.query("ROLLBACK TO SAVEPOINT sp_historial"); /* tabla historial aún no migrada */ }

    } else if (body.accion === "revertir_ultimo_abono") {
      // Leer el último abono del historial
      const histResult = await client.query(
        `SELECT id, monto_bs, monto_usd FROM cuentas_pagar_historial
         WHERE cuenta_pagar_id = $1 ORDER BY id DESC LIMIT 1`,
        [id]
      );
      if (!histResult.rows.length) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No hay abonos registrados para revertir" }, { status: 400 });
      }
      const abono = histResult.rows[0];
      const abonoMontoBs = Number(abono.monto_bs);
      const abonoMontoUsd = Number(abono.monto_usd);

      // Leer saldo actual
      const cpRead = await client.query(
        `SELECT monto_bs, monto_usd, monto_original_bs FROM cuentas_pagar WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const cp = cpRead.rows[0];
      const nuevoMontoBs = Number(cp.monto_bs) + abonoMontoBs;
      const nuevoMontoUsd = Number(cp.monto_usd) + abonoMontoUsd;
      const originalBs = cp.monto_original_bs ? Number(cp.monto_original_bs) : nuevoMontoBs;

      // Determinar nuevo estado
      const nuevoEstado = nuevoMontoBs >= originalBs * 0.999 ? "PENDIENTE" : "PENDIENTE_PARCIAL";

      await client.query(
        `UPDATE cuentas_pagar SET
           monto_bs = $2::numeric,
           monto_usd = $3::numeric,
           estado = $4,
           pagado_at = NULL
         WHERE id = $1`,
        [id, nuevoMontoBs, nuevoMontoUsd, nuevoEstado]
      );

      // Eliminar el registro del historial revertido
      await client.query(`DELETE FROM cuentas_pagar_historial WHERE id = $1`, [abono.id]);

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.gastos)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id: idStr2 } = await params;
  const id = Number(idStr2);
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

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let cResult;
    try {
      cResult = await pool.query(
        `SELECT c.id, c.fecha, c.proveedor_id, c.proveedor_nombre, c.proveedor_rif,
                c.numero_factura, c.observaciones, c.tasa_dia, c.estado, c.anulada_at,
                c.imagen_factura, c.created_at, c.tipo_uso
         FROM compras c WHERE c.id = $1`, [id]
      );
    } catch {
      // columna tipo_uso pendiente de migración 053
      cResult = await pool.query(
        `SELECT c.id, c.fecha, c.proveedor_id, c.proveedor_nombre, c.proveedor_rif,
                c.numero_factura, c.observaciones, c.tasa_dia, c.estado, c.anulada_at,
                c.imagen_factura, c.created_at
         FROM compras c WHERE c.id = $1`, [id]
      );
    }
    if (!cResult.rowCount) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    let iResult;
    try {
      iResult = await pool.query(
        `SELECT ci.id, ci.producto_id, ci.nombre_producto, ci.cantidad, ci.costo_unit_bs, ci.subtotal_bs, ci.tipo_uso
         FROM compra_items ci WHERE ci.compra_id = $1 ORDER BY ci.id`, [id]
      );
    } catch {
      // columna tipo_uso pendiente de migración 063
      iResult = await pool.query(
        `SELECT ci.id, ci.producto_id, ci.nombre_producto, ci.cantidad, ci.costo_unit_bs, ci.subtotal_bs
         FROM compra_items ci WHERE ci.compra_id = $1 ORDER BY ci.id`, [id]
      );
    }

    const c = cResult.rows[0];
    return NextResponse.json({
      id: c.id, fecha: c.fecha,
      proveedorId: c.proveedor_id, proveedorNombre: c.proveedor_nombre, proveedorRif: c.proveedor_rif,
      numeroFactura: c.numero_factura, observaciones: c.observaciones,
      tasaDia: Number(c.tasa_dia), estado: c.estado, anuladaAt: c.anulada_at,
      tipoUso: c.tipo_uso ?? "VENTA",
      imagenFactura: c.imagen_factura, createdAt: c.created_at,
      items: iResult.rows.map((r) => ({
        id: r.id, productoId: r.producto_id, nombreProducto: r.nombre_producto,
        cantidad: Number(r.cantidad), costoUnitBs: Number(r.costo_unit_bs), subtotalBs: Number(r.subtotal_bs),
        tipoUso: r.tipo_uso ?? c.tipo_uso ?? "VENTA",
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "Solo ADMIN puede anular" }, { status: 403 });

  const body = await request.json();
  if (body.accion !== "anular") return NextResponse.json({ error: "Acción inválida" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cResult = await client.query(`SELECT estado FROM compras WHERE id = $1 FOR UPDATE`, [id]);
    if (!cResult.rowCount) throw new Error("Compra no encontrada");
    if (cResult.rows[0].estado === "ANULADA") throw new Error("La compra ya está anulada");

    await client.query(
      `UPDATE compras SET estado = 'ANULADA', anulada_at = now() WHERE id = $1`, [id]
    );

    // Revertir inventario
    const items = await client.query(
      `SELECT producto_id, cantidad, nombre_producto FROM compra_items WHERE compra_id = $1 AND producto_id IS NOT NULL`, [id]
    );
    for (const item of items.rows) {
      const pResult = await client.query(`SELECT stock_actual FROM productos WHERE id = $1 FOR UPDATE`, [item.producto_id]);
      if (pResult.rowCount && pResult.rowCount > 0) {
        const nuevoStock = Math.max(0, Number(pResult.rows[0].stock_actual) - Number(item.cantidad));
        await client.query(`UPDATE productos SET stock_actual = $1 WHERE id = $2`, [nuevoStock, item.producto_id]);
        await client.query(
          `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota) VALUES ($1,'AJUSTE',$2,$3)`,
          [item.producto_id, -Number(item.cantidad), `Anulación Compra #${id}`]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const sesion = await getSesionFromRequest(_req);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (sesion.rol !== "ADMIN" && !sesion.permisos.eliminarCompras) {
    return NextResponse.json({ error: "Sin permiso para eliminar facturas" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cResult = await client.query(`SELECT estado FROM compras WHERE id = $1 FOR UPDATE`, [id]);
    if (!cResult.rowCount) throw new Error("Factura no encontrada");
    if (cResult.rows[0].estado !== "ANULADA") throw new Error("Solo se pueden eliminar facturas anuladas");
    await client.query(`DELETE FROM compras WHERE id = $1`, [id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();
  const {
    fecha,
    proveedorNombre,
    proveedorRif,
    proveedorId,
    numeroFactura,
    observaciones,
    tasaDia,
    items,
    imagenFactura,
    fechaVencimientoPago,
    tipoUso,
  } = body;
  const tipoUsoValido = tipoUso === "MATERIA_PRIMA" ? "MATERIA_PRIMA" : "VENTA";

  if (!fecha || !proveedorNombre || !Array.isArray(items)) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cResult = await client.query(
      `SELECT estado FROM compras WHERE id = $1 FOR UPDATE`, [id]
    );
    if (!cResult.rowCount) throw new Error("Compra no encontrada");
    if (cResult.rows[0].estado === "ANULADA") throw new Error("No se puede editar una compra anulada");

    await client.query("SAVEPOINT antes_tipo_uso");
    try {
      await client.query(
        `UPDATE compras
         SET fecha = $1,
             proveedor_nombre = $2,
             proveedor_rif = $3,
             proveedor_id = $4,
             numero_factura = $5,
             observaciones = $6,
             tasa_dia = $7,
             imagen_factura = $8,
             fecha_vencimiento_pago = $9,
             tipo_uso = $10
         WHERE id = $11`,
        [fecha, proveedorNombre, proveedorRif ?? null, proveedorId ?? null,
         numeroFactura ?? null, observaciones ?? null, tasaDia ?? null,
         imagenFactura ?? null, fechaVencimientoPago ?? null, tipoUsoValido, id]
      );
    } catch {
      // columna tipo_uso pendiente de migración 053 — actualizar sin ella
      await client.query("ROLLBACK TO SAVEPOINT antes_tipo_uso");
      await client.query(
        `UPDATE compras
         SET fecha = $1,
             proveedor_nombre = $2,
             proveedor_rif = $3,
             proveedor_id = $4,
             numero_factura = $5,
             observaciones = $6,
             tasa_dia = $7,
             imagen_factura = $8,
             fecha_vencimiento_pago = $9
         WHERE id = $10`,
        [fecha, proveedorNombre, proveedorRif ?? null, proveedorId ?? null,
         numeroFactura ?? null, observaciones ?? null, tasaDia ?? null,
         imagenFactura ?? null, fechaVencimientoPago ?? null, id]
      );
    }

    await client.query(`DELETE FROM compra_items WHERE compra_id = $1`, [id]);

    await client.query("SAVEPOINT antes_items_tipo_uso");
    let itemsTipoUsoDisponible = true;

    for (const item of items) {
      const { productoId, nombreProducto, cantidad, costoUnitBs } = item;
      const subtotalBs = Number(cantidad) * Number(costoUnitBs);
      const itemTipoUso = item.tipoUso === "MATERIA_PRIMA" ? "MATERIA_PRIMA" : tipoUsoValido;

      if (itemsTipoUsoDisponible) {
        try {
          await client.query(
            `INSERT INTO compra_items (compra_id, producto_id, nombre_producto, cantidad, costo_unit_bs, subtotal_bs, tipo_uso)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [id, productoId ?? null, nombreProducto ?? null, cantidad, costoUnitBs, subtotalBs, itemTipoUso]
          );
        } catch {
          // columna tipo_uso pendiente de migración 063
          await client.query("ROLLBACK TO SAVEPOINT antes_items_tipo_uso");
          itemsTipoUsoDisponible = false;
          await client.query(
            `INSERT INTO compra_items (compra_id, producto_id, nombre_producto, cantidad, costo_unit_bs, subtotal_bs)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, productoId ?? null, nombreProducto ?? null, cantidad, costoUnitBs, subtotalBs]
          );
        }
      } else {
        await client.query(
          `INSERT INTO compra_items (compra_id, producto_id, nombre_producto, cantidad, costo_unit_bs, subtotal_bs)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, productoId ?? null, nombreProducto ?? null, cantidad, costoUnitBs, subtotalBs]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.eliminarCompras)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;
  try {
    const check = await pool.query(`SELECT estado FROM compras WHERE id = $1`, [id]);
    if (!check.rowCount) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    if (check.rows[0].estado !== "ANULADA") {
      return NextResponse.json({ error: "Solo se pueden eliminar facturas anuladas" }, { status: 409 });
    }
    await pool.query(`DELETE FROM compra_items WHERE compra_id = $1`, [id]);
    await pool.query(`DELETE FROM compras WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

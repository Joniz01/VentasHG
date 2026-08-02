import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getConteoFromRequest, getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

// GET — detalle de un conteo con items
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  // Accept both conteo users (app) and main users (supervisor bandeja)
  const conteoSesion = await getConteoFromRequest(request);
  const mainSesion = await getSesionFromRequest(request);
  if (!conteoSesion && !mainSesion) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const ciResult = await pool.query(
    `SELECT ci.id, ci.estado, ci.nota, ci.created_at, ci.updated_at,
            ci.nota_supervisor, ci.aprobado_at,
            cu.nombre AS conteo_usuario_nombre, cu.id AS conteo_usuario_id,
            u.nombre AS aprobado_por_nombre
     FROM conteo_inventario ci
     LEFT JOIN conteo_usuarios cu ON cu.id = ci.conteo_usuario_id
     LEFT JOIN usuarios u ON u.id = ci.aprobado_por
     WHERE ci.id = $1`,
    [id]
  );

  if (ciResult.rowCount === 0) {
    return NextResponse.json({ error: "Conteo no encontrado" }, { status: 404 });
  }

  const itemsResult = await pool.query(
    `SELECT cii.id, cii.producto_id, p.nombre AS producto_nombre,
            COALESCE(cat.nombre, NULL) AS categoria_nombre,
            COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,
            cii.stock_sistema, cii.stock_contado, cii.stock_corregido,
            COALESCE(cii.stock_corregido, cii.stock_contado) - cii.stock_sistema AS diferencia,
            u.nombre AS corregido_por, cii.corregido_at, cii.nota
     FROM conteo_inventario_items cii
     JOIN productos p ON p.id = cii.producto_id
     LEFT JOIN categorias cat ON cat.id = p.categoria_id
     LEFT JOIN usuarios u ON u.id = cii.corregido_por
     WHERE cii.conteo_id = $1
     ORDER BY cat.nombre ASC NULLS LAST, p.nombre ASC`,
    [id]
  );

  const ci = ciResult.rows[0];
  return NextResponse.json({
    id: ci.id,
    conteoUsuarioId: ci.conteo_usuario_id,
    conteoUsuarioNombre: ci.conteo_usuario_nombre ?? null,
    estado: ci.estado,
    nota: ci.nota,
    aprobadoPor: ci.aprobado_por_nombre ?? null,
    aprobadoAt: ci.aprobado_at ?? null,
    notaSupervisor: ci.nota_supervisor ?? null,
    createdAt: ci.created_at,
    updatedAt: ci.updated_at,
    items: itemsResult.rows.map((r) => ({
      id: r.id,
      productoId: r.producto_id,
      productoNombre: r.producto_nombre,
      categoriaNombre: r.categoria_nombre ?? null,
      unidadMedida: r.unidad_medida,
      stockSistema: Number(r.stock_sistema),
      stockContado: Number(r.stock_contado),
      stockCorregido: r.stock_corregido != null ? Number(r.stock_corregido) : null,
      diferencia: Number(r.diferencia),
      corregidoPor: r.corregido_por ?? null,
      corregidoAt: r.corregido_at ?? null,
      nota: r.nota ?? null,
    })),
  });
}

// PATCH — enviar, aprobar, rechazar, o corregir items (supervisor)
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  // ── Enviar conteo (acción del contador) ──
  if (body.accion === "ENVIAR") {
    const sesion = await getConteoFromRequest(request);
    if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    await pool.query(
      `UPDATE conteo_inventario SET estado = 'ENVIADO', updated_at = NOW()
       WHERE id = $1 AND estado = 'BORRADOR' AND conteo_usuario_id = $2`,
      [id, sesion.id]
    );
    return NextResponse.json({ ok: true });
  }

  // ── Aprobar / Rechazar (acción del supervisor) ──
  if (body.accion === "APROBAR" || body.accion === "RECHAZAR") {
    const sesion = await getSesionFromRequest(request);
    if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (sesion.rol !== "ADMIN" && !sesion.permisos.autorizarConteo) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const notaSupervisor = typeof body.notaSupervisor === "string" ? body.notaSupervisor.trim() || null : null;

      await client.query(
        `UPDATE conteo_inventario
         SET estado = $1, aprobado_por = $2, aprobado_at = NOW(),
             nota_supervisor = $3, updated_at = NOW()
         WHERE id = $4 AND estado = 'ENVIADO'`,
        [body.accion === "APROBAR" ? "APROBADO" : "RECHAZADO", sesion.id, notaSupervisor, id]
      );

      // Si se aprueba, generar movimientos CONTEO en inventario_movimientos
      if (body.accion === "APROBAR") {
        const itemsResult = await client.query(
          `SELECT cii.producto_id,
                  COALESCE(cii.stock_corregido, cii.stock_contado) - cii.stock_sistema AS diferencia
           FROM conteo_inventario_items cii
           WHERE cii.conteo_id = $1`,
          [id]
        );

        for (const item of itemsResult.rows) {
          const diff = Number(item.diferencia);
          if (diff === 0) continue;

          // Update product stock
          await client.query(
            `UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2`,
            [diff, item.producto_id]
          );

          // Insert movement with CONTEO origin
          try {
            await client.query(
              `INSERT INTO inventario_movimientos
                 (producto_id, tipo, cantidad, nota, usuario_id, origen)
               VALUES ($1, 'AJUSTE', $2, 'Conteo físico aprobado', $3, 'CONTEO')`,
              [item.producto_id, diff, sesion.id]
            );
          } catch {
            await client.query(
              `INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota)
               VALUES ($1, 'AJUSTE', $2, 'Conteo físico aprobado')`,
              [item.producto_id, diff]
            );
          }
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      const msg = err instanceof Error ? err.message : "Error al procesar";
      return NextResponse.json({ error: msg }, { status: 500 });
    } finally {
      client.release();
    }
  }

  // ── Corregir un item (supervisor antes de aprobar) ──
  if (body.accion === "CORREGIR_ITEM") {
    const sesion = await getSesionFromRequest(request);
    if (!sesion) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (sesion.rol !== "ADMIN" && !sesion.permisos.autorizarConteo) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const { itemId, stockCorregido, nota } = body;
    if (itemId == null || stockCorregido == null) {
      return NextResponse.json({ error: "itemId y stockCorregido son requeridos" }, { status: 400 });
    }

    await pool.query(
      `UPDATE conteo_inventario_items
       SET stock_corregido = $1, corregido_por = $2, corregido_at = NOW(), nota = COALESCE($3, nota)
       WHERE id = $4 AND conteo_id = $5`,
      [Number(stockCorregido), sesion.id, nota ?? null, itemId, id]
    );

    await pool.query(
      `UPDATE conteo_inventario SET updated_at = NOW() WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

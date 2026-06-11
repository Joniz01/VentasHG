import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest, hashPassword } from "@/lib/auth";
import { PERMISOS_VACIOS, ROLES, type UsuarioInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as Partial<UsuarioInput> & { activo?: boolean };

  if (!body.nombre?.trim() || !body.usuario?.trim()) {
    return NextResponse.json({ error: "Nombre y usuario son obligatorios" }, { status: 400 });
  }

  if (!body.rol || !ROLES.includes(body.rol)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const isSelf = Number(id) === sesion.id;
  if (isSelf && (body.rol !== "ADMIN" || body.activo === false)) {
    return NextResponse.json(
      { error: "No puedes quitarte tu propio rol de administrador o desactivar tu cuenta" },
      { status: 400 }
    );
  }

  const permisos =
    body.rol === "ADMIN"
      ? { productos: true, ventas: true, reportes: true, pedidosPendientes: true }
      : body.permisos ?? PERMISOS_VACIOS;

  try {
    const result = body.clave?.trim()
      ? await pool.query(
          `UPDATE usuarios
           SET nombre = $1, usuario = $2, clave_hash = $3, rol = $4, activo = $5,
               ve_productos = $6, ve_ventas = $7, ve_reportes = $8, ve_pedidos_pendientes = $9
           WHERE id = $10
           RETURNING id`,
          [
            body.nombre.trim(),
            body.usuario.trim(),
            hashPassword(body.clave),
            body.rol,
            body.activo ?? true,
            permisos.productos,
            permisos.ventas,
            permisos.reportes,
            permisos.pedidosPendientes,
            id,
          ]
        )
      : await pool.query(
          `UPDATE usuarios
           SET nombre = $1, usuario = $2, rol = $3, activo = $4,
               ve_productos = $5, ve_ventas = $6, ve_reportes = $7, ve_pedidos_pendientes = $8
           WHERE id = $9
           RETURNING id`,
          [
            body.nombre.trim(),
            body.usuario.trim(),
            body.rol,
            body.activo ?? true,
            permisos.productos,
            permisos.ventas,
            permisos.reportes,
            permisos.pedidosPendientes,
            id,
          ]
        );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "El usuario ya existe"
        : "Error al actualizar el usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;

  if (Number(id) === sesion.id) {
    return NextResponse.json(
      { error: "No puedes eliminar tu propia cuenta" },
      { status: 400 }
    );
  }

  const result = await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

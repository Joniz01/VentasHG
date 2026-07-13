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
      ? { productos: true, ventas: true, reportes: true, pedidosPendientes: true, descuento: true, dashboard: true, compras: true, eliminarCompras: true }
      : body.permisos ?? PERMISOS_VACIOS;

  const nombre = body.nombre!.trim();
  const usuario = body.usuario!.trim();
  const rol = body.rol;
  const activo = body.activo ?? true;
  const claveHash = body.clave?.trim() ? hashPassword(body.clave) : null;

  type UpdateOpts = { dashboard: boolean; compras: boolean; eliminarCompras: boolean };

  const runUpdate = async (opts: UpdateOpts) => {
    const cols: string[] = [];
    const vals: unknown[] = [];

    const add = (col: string, val: unknown) => { cols.push(`${col}=$${cols.length + 1}`); vals.push(val); };

    add("nombre", nombre);
    add("usuario", usuario);
    if (claveHash) add("clave_hash", claveHash);
    add("rol", rol);
    add("activo", activo);
    add("ve_productos", permisos.productos);
    add("ve_ventas", permisos.ventas);
    add("ve_reportes", permisos.reportes);
    add("ve_pedidos_pendientes", permisos.pedidosPendientes);
    add("ve_descuento", permisos.descuento);
    if (opts.dashboard) add("ve_dashboard", permisos.dashboard);
    if (opts.compras) add("ve_compras", permisos.compras);
    if (opts.eliminarCompras) add("ve_eliminar_compras", permisos.eliminarCompras);

    vals.push(id);
    return pool.query(
      `UPDATE usuarios SET ${cols.join(",")} WHERE id=$${vals.length} RETURNING id`,
      vals
    );
  };

  try {
    let result;
    try {
      result = await runUpdate({ dashboard: true, compras: true, eliminarCompras: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("ve_eliminar_compras")) {
        try {
          result = await runUpdate({ dashboard: true, compras: true, eliminarCompras: false });
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : "";
          if (msg2.includes("ve_dashboard") || msg2.includes("ve_compras")) {
            result = await runUpdate({ dashboard: false, compras: false, eliminarCompras: false });
          } else throw e2;
        }
      } else if (msg.includes("ve_dashboard") || msg.includes("ve_compras")) {
        result = await runUpdate({ dashboard: false, compras: false, eliminarCompras: false });
      } else {
        throw e;
      }
    }

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

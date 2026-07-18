import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest, hasAnyUsuario, hashPassword } from "@/lib/auth";
import { PERMISOS_VACIOS, ROLES, type UsuarioInput } from "@/lib/types";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let rows: Record<string, unknown>[] = [];
  try {
    const result = await pool.query(
      `SELECT id, nombre, usuario, rol, activo,
              ve_productos, ve_ventas, ve_reportes, ve_pedidos_pendientes, ve_descuento,
              COALESCE(ve_dashboard, FALSE) AS ve_dashboard,
              COALESCE(ve_compras, FALSE) AS ve_compras,
              COALESCE(ve_eliminar_compras, FALSE) AS ve_eliminar_compras,
              COALESCE(ve_gastos, FALSE) AS ve_gastos
       FROM usuarios ORDER BY nombre ASC`
    );
    rows = result.rows;
  } catch {
    // Columnas opcionales pendientes de migración
    const result = await pool.query(
      `SELECT id, nombre, usuario, rol, activo,
              ve_productos, ve_ventas, ve_reportes, ve_pedidos_pendientes, ve_descuento
       FROM usuarios ORDER BY nombre ASC`
    );
    rows = result.rows;
  }

  const usuarios = rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    usuario: row.usuario,
    rol: row.rol,
    activo: row.activo,
    permisos: {
      productos: row.ve_productos,
      ventas: row.ve_ventas,
      reportes: row.ve_reportes,
      pedidosPendientes: row.ve_pedidos_pendientes,
      descuento: row.ve_descuento,
      dashboard: (row.ve_dashboard ?? row.rol === "ADMIN") as boolean,
      compras: (row.ve_compras ?? false) as boolean,
      eliminarCompras: (row.ve_eliminar_compras ?? row.rol === "ADMIN") as boolean,
      gastos: (row.ve_gastos ?? false) as boolean,
    },
  }));

  return NextResponse.json(usuarios);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as UsuarioInput;

  if (!body.nombre?.trim() || !body.usuario?.trim() || !body.clave?.trim()) {
    return NextResponse.json(
      { error: "Nombre, usuario y clave son obligatorios" },
      { status: 400 }
    );
  }

  const isBootstrap = !(await hasAnyUsuario());

  let rol = body.rol;
  let permisos = body.permisos ?? PERMISOS_VACIOS;

  if (isBootstrap) {
    rol = "ADMIN";
    permisos = { productos: true, ventas: true, reportes: true, pedidosPendientes: true, descuento: true, dashboard: true, compras: true, eliminarCompras: true, gastos: true };
  } else {
    const sesion = await getSesionFromRequest(request);
    if (!sesion || sesion.rol !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (!ROLES.includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    if (rol === "ADMIN") {
      permisos = { productos: true, ventas: true, reportes: true, pedidosPendientes: true, descuento: true, dashboard: true, compras: true, eliminarCompras: true, gastos: true };
    }
  }

  try {
    let insertId: number;
    try {
      const r = await pool.query(
        `INSERT INTO usuarios (nombre, usuario, clave_hash, rol, ve_productos, ve_ventas, ve_reportes, ve_pedidos_pendientes, ve_descuento, ve_dashboard)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [body.nombre.trim(), body.usuario.trim(), hashPassword(body.clave), rol,
         permisos.productos, permisos.ventas, permisos.reportes, permisos.pedidosPendientes, permisos.descuento, permisos.dashboard]
      );
      insertId = r.rows[0].id;
    } catch (e) {
      if (e instanceof Error && e.message.includes("ve_dashboard")) {
        // Migración 023 pendiente — insertar sin ve_dashboard
        const r = await pool.query(
          `INSERT INTO usuarios (nombre, usuario, clave_hash, rol, ve_productos, ve_ventas, ve_reportes, ve_pedidos_pendientes, ve_descuento)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [body.nombre.trim(), body.usuario.trim(), hashPassword(body.clave), rol,
           permisos.productos, permisos.ventas, permisos.reportes, permisos.pedidosPendientes, permisos.descuento]
        );
        insertId = r.rows[0].id;
      } else {
        throw e;
      }
    }
    return NextResponse.json({ id: insertId }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("duplicate")
        ? "El usuario ya existe"
        : "Error al crear el usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

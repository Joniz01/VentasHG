import crypto from "crypto";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import type { PermisosUsuario, Rol } from "@/lib/types";

export const SESSION_COOKIE = "vhg_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = crypto.scryptSync(password, salt, hashBuffer.length);
  return crypto.timingSafeEqual(hashBuffer, candidate);
}

export async function hasAnyUsuario(): Promise<boolean> {
  const result = await pool.query(`SELECT 1 FROM usuarios LIMIT 1`);
  return (result.rowCount ?? 0) > 0;
}

export async function createUserSession(
  usuarioId: number
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await pool.query(
    `INSERT INTO sesiones (token, usuario_id, expires_at) VALUES ($1, $2, $3)`,
    [token, usuarioId, expiresAt]
  );

  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sesiones WHERE token = $1`, [token]);
}

export type SesionUsuario = {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
  permisos: PermisosUsuario;
};

export async function getUsuarioFromSession(token: string): Promise<SesionUsuario | null> {
  let row: Record<string, unknown> | undefined;

  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.usuario, u.rol,
              u.ve_productos, u.ve_ventas, u.ve_reportes, u.ve_pedidos_pendientes, u.ve_descuento,
              COALESCE(u.ve_dashboard, FALSE) AS ve_dashboard,
              COALESCE(u.ve_compras, FALSE) AS ve_compras
       FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = $1 AND s.expires_at > now() AND u.activo = TRUE`,
      [token]
    );
    row = result.rows[0];
  } catch {
    // Migración 023 pendiente: ve_dashboard no existe aún
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.usuario, u.rol,
              u.ve_productos, u.ve_ventas, u.ve_reportes, u.ve_pedidos_pendientes, u.ve_descuento
       FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token = $1 AND s.expires_at > now() AND u.activo = TRUE`,
      [token]
    );
    row = result.rows[0];
  }

  if (!row) return null;

  return {
    id: row.id as number,
    nombre: row.nombre as string,
    usuario: row.usuario as string,
    rol: row.rol as Rol,
    permisos: {
      productos: row.ve_productos as boolean,
      ventas: row.ve_ventas as boolean,
      reportes: row.ve_reportes as boolean,
      pedidosPendientes: row.ve_pedidos_pendientes as boolean,
      descuento: row.ve_descuento as boolean,
      // Si la columna no existe aún, ADMIN recibe true por defecto
      dashboard: (row.ve_dashboard ?? row.rol === "ADMIN") as boolean,
      compras: (row.ve_compras ?? false) as boolean,
    },
  };
}

export async function getSesionFromRequest(request: NextRequest): Promise<SesionUsuario | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUsuarioFromSession(token);
}

export async function requirePermiso(permiso: keyof PermisosUsuario): Promise<SesionUsuario> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sesion = token ? await getUsuarioFromSession(token) : null;

  if (!sesion) {
    redirect("/admin");
  }

  if (sesion.rol !== "ADMIN" && !sesion.permisos[permiso]) {
    redirect("/sin-acceso");
  }

  return sesion;
}

export const MOTORIZADO_SESSION_COOKIE = "vhg_motorizado_session";

export async function createMotorizadoSession(
  motorizadoId: number
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await pool.query(
    `INSERT INTO motorizado_sesiones (token, motorizado_id, expires_at) VALUES ($1, $2, $3)`,
    [token, motorizadoId, expiresAt]
  );

  return { token, expiresAt };
}

export async function deleteMotorizadoSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM motorizado_sesiones WHERE token = $1`, [token]);
}

export async function getMotorizadoIdFromSession(token: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT motorizado_id FROM motorizado_sesiones WHERE token = $1 AND expires_at > now()`,
    [token]
  );
  return result.rows[0]?.motorizado_id ?? null;
}

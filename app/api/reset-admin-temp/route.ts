import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// ENDPOINT TEMPORAL — eliminar después de usarlo
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const nuevaClave = request.nextUrl.searchParams.get("clave");

  if (secret !== process.env.RESET_SECRET || !nuevaClave) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const hash = hashPassword(nuevaClave);
  await pool.query(
    `UPDATE usuarios SET clave_hash = $1, activo = TRUE WHERE usuario = 'admin'`,
    [hash]
  );

  return NextResponse.json({ ok: true, mensaje: "Clave actualizada. Elimina este endpoint." });
}

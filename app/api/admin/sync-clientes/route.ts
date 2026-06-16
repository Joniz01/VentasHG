import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import { guardarCliente, type VentaBody } from "@/lib/ventas";

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ventasResult = await client.query(
      `SELECT cliente, cliente_ci, cliente_telefono, direccion FROM ventas ORDER BY id`
    );

    for (const row of ventasResult.rows) {
      if (!row.cliente?.trim()) continue;
      await guardarCliente(client, {
        cliente: row.cliente,
        clienteCi: row.cliente_ci,
        clienteTelefono: row.cliente_telefono,
        direccion: row.direccion,
      } as VentaBody);
    }

    await client.query("COMMIT");

    return NextResponse.json({ sincronizados: ventasResult.rowCount });
  } catch (err) {
    await client.query("ROLLBACK");
    const message = err instanceof Error ? err.message : "Error al sincronizar";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}

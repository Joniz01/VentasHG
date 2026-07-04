import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(`SELECT clave, valor FROM configuracion`);
  const config: Record<string, string> = {};
  for (const row of result.rows) {
    config[row.clave] = row.valor;
  }
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  for (const [clave, valor] of Object.entries(body)) {
    await pool.query(
      `INSERT INTO configuracion (clave, valor) VALUES ($1, $2)
       ON CONFLICT (clave) DO UPDATE SET valor = $2`,
      [clave, String(valor)]
    );
  }
  return NextResponse.json({ ok: true });
}

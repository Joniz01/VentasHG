import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";
import { CLIENTES_CONFIG_DEFAULT, type ClientesConfig } from "@/lib/types";

const CONFIG_KEY = "clientes_config";

function normalizarConfig(value: unknown): ClientesConfig {
  if (!value || typeof value !== "object") return { ...CLIENTES_CONFIG_DEFAULT };
  const v = value as Record<string, unknown>;

  return {
    nombreObligatorio: typeof v.nombreObligatorio === "boolean" ? v.nombreObligatorio : CLIENTES_CONFIG_DEFAULT.nombreObligatorio,
    apellidoObligatorio: typeof v.apellidoObligatorio === "boolean" ? v.apellidoObligatorio : CLIENTES_CONFIG_DEFAULT.apellidoObligatorio,
    cedulaObligatoria: typeof v.cedulaObligatoria === "boolean" ? v.cedulaObligatoria : CLIENTES_CONFIG_DEFAULT.cedulaObligatoria,
    telefonoObligatorio: typeof v.telefonoObligatorio === "boolean" ? v.telefonoObligatorio : CLIENTES_CONFIG_DEFAULT.telefonoObligatorio,
    direccionObligatoria: typeof v.direccionObligatoria === "boolean" ? v.direccionObligatoria : CLIENTES_CONFIG_DEFAULT.direccionObligatoria,
  };
}

export async function GET() {
  const result = await pool.query(`SELECT value FROM app_config WHERE key = $1`, [CONFIG_KEY]);

  if (!result.rows[0]) {
    return NextResponse.json(CLIENTES_CONFIG_DEFAULT);
  }

  try {
    const parsed = JSON.parse(result.rows[0].value) as Partial<ClientesConfig>;
    return NextResponse.json(normalizarConfig(parsed));
  } catch {
    return NextResponse.json(CLIENTES_CONFIG_DEFAULT);
  }
}

export async function PUT(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<ClientesConfig>;
  const config = normalizarConfig(body);

  await pool.query(
    `INSERT INTO app_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [CONFIG_KEY, JSON.stringify(config)]
  );

  return NextResponse.json(config);
}

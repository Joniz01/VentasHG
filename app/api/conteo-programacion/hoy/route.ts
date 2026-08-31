import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function venceHoy(row: Record<string, unknown>): boolean {
  const today = new Date();
  const dow = today.getDay();
  const dom = today.getDate();
  const DOW: Record<string, number> = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 };

  switch (row.recurrencia) {
    case "DIARIA": return true;
    case "SEMANAL": {
      const dias = (row.dias_semana as string[] | null) ?? [];
      return dias.some((d) => DOW[d] === dow);
    }
    case "QUINCENAL": {
      const dia = Number(row.dia_numero ?? 1);
      return dom === dia || dom === Math.min(dia + 15, 28);
    }
    case "MENSUAL": return dom === Number(row.dia_numero ?? 1);
    case "FECHA": {
      if (!row.fecha_especifica) return false;
      const f = row.fecha_especifica instanceof Date
        ? row.fecha_especifica.toISOString().slice(0, 10)
        : String(row.fecha_especifica).slice(0, 10);
      const t = new Date();
      return f === `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    }
    default: return false;
  }
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ count: 0, programaciones: [] });

  const result = await pool.query(
    `SELECT id, nombre, alcance, uso, recurrencia, dias_semana, dia_numero, fecha_especifica, usuarios_alerta
     FROM conteo_programacion
     WHERE activo = TRUE AND ($1 = ANY(usuarios_alerta) OR $2 = 'ADMIN')
     ORDER BY nombre ASC`,
    [sesion.id, sesion.rol]
  );

  const debidas = result.rows.filter(venceHoy);

  return NextResponse.json({ count: debidas.length, programaciones: debidas.map((r) => ({ id: r.id, nombre: r.nombre })) });
}

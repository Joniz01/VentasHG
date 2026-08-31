import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
      const dia2 = Math.min(dia + 15, 28);
      return dom === dia || dom === dia2;
    }
    case "MENSUAL": return dom === Number(row.dia_numero ?? 1);
    case "FECHA": {
      if (!row.fecha_especifica) return false;
      const f = row.fecha_especifica instanceof Date
        ? row.fecha_especifica.toISOString().slice(0, 10)
        : String(row.fecha_especifica).slice(0, 10);
      return f === toDateStr(today);
    }
    default: return false;
  }
}

function proximaFecha(row: Record<string, unknown>): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DOW: Record<string, number> = { DOM: 0, LUN: 1, MAR: 2, MIE: 3, JUE: 4, VIE: 5, SAB: 6 };

  switch (row.recurrencia) {
    case "DIARIA": return toDateStr(today);
    case "SEMANAL": {
      const dias = (row.dias_semana as string[] | null) ?? [];
      if (!dias.length) return null;
      const dows = dias.map((d) => DOW[d]).sort((a, b) => a - b);
      const currentDow = today.getDay();
      const next = dows.find((d) => d >= currentDow) ?? dows[0];
      const diff = next >= currentDow ? next - currentDow : 7 - currentDow + next;
      const d = new Date(today);
      d.setDate(d.getDate() + diff);
      return toDateStr(d);
    }
    case "QUINCENAL": {
      const dia = Number(row.dia_numero ?? 1);
      const dia2 = Math.min(dia + 15, 28);
      const dom = today.getDate();
      if (dom <= dia) return toDateStr(new Date(today.getFullYear(), today.getMonth(), dia));
      if (dom <= dia2) return toDateStr(new Date(today.getFullYear(), today.getMonth(), dia2));
      return toDateStr(new Date(today.getFullYear(), today.getMonth() + 1, dia));
    }
    case "MENSUAL": {
      const dia = Number(row.dia_numero ?? 1);
      const dom = today.getDate();
      if (dom <= dia) return toDateStr(new Date(today.getFullYear(), today.getMonth(), dia));
      return toDateStr(new Date(today.getFullYear(), today.getMonth() + 1, dia));
    }
    case "FECHA": {
      if (!row.fecha_especifica) return null;
      return row.fecha_especifica instanceof Date
        ? row.fecha_especifica.toISOString().slice(0, 10)
        : String(row.fecha_especifica).slice(0, 10);
    }
    default: return null;
  }
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    nombre: r.nombre,
    alcance: r.alcance,
    categoriaId: r.categoria_id ?? null,
    categoriaNombre: r.categoria_nombre ?? null,
    productoId: r.producto_id ?? null,
    productoNombre: r.producto_nombre ?? null,
    uso: r.uso ?? null,
    recurrencia: r.recurrencia,
    diasSemana: (r.dias_semana as string[] | null) ?? [],
    diaNumerо: r.dia_numero ?? null,
    diaNumero: r.dia_numero ?? null,
    fechaEspecifica: r.fecha_especifica
      ? (r.fecha_especifica instanceof Date ? r.fecha_especifica.toISOString().slice(0, 10) : String(r.fecha_especifica).slice(0, 10))
      : null,
    usuariosAlerta: (r.usuarios_alerta as number[] | null) ?? [],
    usuariosAlertaNombres: (r.usuarios_nombres as string[] | null) ?? [],
    activo: r.activo,
    createdAt: r.created_at,
    venceHoy: venceHoy(r),
    proximaFecha: proximaFecha(r),
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.programarConteo && !sesion.permisos.autorizarConteo)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const result = await pool.query(
    `SELECT cp.*,
            c.nombre AS categoria_nombre,
            p.nombre AS producto_nombre,
            ARRAY(
              SELECT u.nombre FROM usuarios u WHERE u.id = ANY(cp.usuarios_alerta)
            ) AS usuarios_nombres
     FROM conteo_programacion cp
     LEFT JOIN categorias c ON c.id = cp.categoria_id
     LEFT JOIN productos p ON p.id = cp.producto_id
     ORDER BY cp.created_at DESC`
  );

  return NextResponse.json(result.rows.map(mapRow));
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || (sesion.rol !== "ADMIN" && !sesion.permisos.programarConteo)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json() as {
    nombre: string;
    alcance: string;
    categoriaId?: number | null;
    productoId?: number | null;
    uso?: string | null;
    recurrencia: string;
    diasSemana?: string[];
    diaNumero?: number | null;
    fechaEspecifica?: string | null;
    usuariosAlerta?: number[];
  };

  if (!body.nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!body.alcance) return NextResponse.json({ error: "Alcance requerido" }, { status: 400 });
  if (!body.recurrencia) return NextResponse.json({ error: "Recurrencia requerida" }, { status: 400 });
  if (body.recurrencia === "SEMANAL" && (!body.diasSemana || !body.diasSemana.length)) {
    return NextResponse.json({ error: "Selecciona al menos un día para recurrencia semanal" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO conteo_programacion
       (nombre, alcance, categoria_id, producto_id, uso, recurrencia, dias_semana, dia_numero, fecha_especifica, usuarios_alerta, activo, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11) RETURNING id`,
    [
      body.nombre.trim(),
      body.alcance,
      body.categoriaId ?? null,
      body.productoId ?? null,
      body.uso ?? null,
      body.recurrencia,
      body.diasSemana?.length ? body.diasSemana : null,
      body.diaNumero ?? null,
      body.fechaEspecifica ?? null,
      body.usuariosAlerta?.length ? body.usuariosAlerta : null,
      sesion.id,
    ]
  );

  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}

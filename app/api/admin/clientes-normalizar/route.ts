import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

function toTitleCase(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function autoSplit(nombre: string): { nombre: string; apellido: string; flagged: boolean } {
  const parts = nombre.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length <= 1) return { nombre: toTitleCase(nombre), apellido: "", flagged: false };
  if (parts.length === 2) return { nombre: toTitleCase(parts[0]), apellido: toTitleCase(parts[1]), flagged: false };
  // 3+ words: first word as nombre, rest as apellido — flagged for review
  return {
    nombre: toTitleCase(parts[0]),
    apellido: toTitleCase(parts.slice(1).join(" ")),
    flagged: true,
  };
}

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const result = await pool.query(
    `SELECT id, nombre, apellido, normalizado, normalizado_at,
            u.nombre AS normalizado_por_nombre
     FROM clientes c
     LEFT JOIN usuarios u ON u.id = c.normalizado_por
     ORDER BY normalizado ASC, id ASC`
  );

  const rows = result.rows.map((r) => {
    const split = autoSplit(r.nombre);
    return {
      id: r.id,
      nombreOriginal: r.nombre,
      apellidoDb: r.apellido ?? null,
      normalizado: r.normalizado ?? false,
      normalizadoAt: r.normalizado_at ?? null,
      normalizadoPor: r.normalizado_por_nombre ?? null,
      // Proposed split (use DB values if already set)
      propNombre: r.apellido !== null ? toTitleCase(r.nombre) : split.nombre,
      propApellido: r.apellido !== null ? toTitleCase(r.apellido) : split.apellido,
      flagged: split.flagged && !r.normalizado,
    };
  });

  const total = rows.length;
  const aprobados = rows.filter((r) => r.normalizado).length;
  const flagged = rows.filter((r) => r.flagged).length;
  const pendientes = rows.filter((r) => !r.normalizado && !r.flagged).length;

  return NextResponse.json({ rows, stats: { total, aprobados, flagged, pendientes } });
}

// Bulk approve all simple (non-flagged, non-normalized) clients
export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion || sesion.rol !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  if (body.action !== "bulk-approve-simple") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT id, nombre FROM clientes WHERE normalizado = FALSE OR normalizado IS NULL`
  );

  const simples = result.rows.filter((r) => {
    const parts = r.nombre.trim().replace(/\s+/g, " ").split(" ");
    return parts.length === 2;
  });

  if (simples.length === 0) return NextResponse.json({ updated: 0 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let updated = 0;
    for (const row of simples) {
      const { nombre, apellido } = autoSplit(row.nombre);
      await client.query(
        `UPDATE clientes SET nombre = $1, apellido = $2, normalizado = TRUE, normalizado_at = NOW(), normalizado_por = $3 WHERE id = $4`,
        [nombre, apellido, sesion.id, row.id]
      );
      updated++;
    }
    await client.query("COMMIT");
    return NextResponse.json({ updated });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  } finally {
    client.release();
  }
}

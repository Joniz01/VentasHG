import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  try {
    const rif = searchParams.get("rif");
    let queryText: string;
    let queryParams: string[];
    let items: { id: number; nombre: string; rifCi: string | null; direccion: string | null; telefono: string | null; diasCredito: number; fuente: string }[];

    if (rif) {
      queryText = `SELECT id, nombre, rif_ci, direccion, telefono, dias_credito FROM proveedores WHERE activo = TRUE AND lower(rif_ci) = lower($1) LIMIT 1`;
      queryParams = [rif.trim()];
      const result = await pool.query(queryText, queryParams);
      items = result.rows.map((r) => ({ id: r.id, nombre: r.nombre, rifCi: r.rif_ci, direccion: r.direccion, telefono: r.telefono, diasCredito: Number(r.dias_credito ?? 0), fuente: "proveedor" }));
    } else {
      const filter = q ? `AND (lower(nombre) LIKE lower($1) OR lower(COALESCE(rif_ci,'')) LIKE lower($1))` : "";
      const params = q ? [`%${q}%`] : [];

      // Proveedores registrados
      const rProv = await pool.query(
        `SELECT id, nombre, rif_ci, direccion, telefono, dias_credito FROM proveedores WHERE activo = TRUE ${filter} ORDER BY nombre ASC LIMIT 50`,
        params
      );

      // Clientes marcados como proveedor (tolerante a columna no migrada)
      let clienteRows: { id: number; nombre: string; cedula: string | null; direccion: string | null; telefono: string | null }[] = [];
      try {
        const rCli = await pool.query(
          `SELECT id, nombre, cedula AS rif_ci, direccion, telefono FROM clientes WHERE es_proveedor = TRUE ${q ? "AND (lower(nombre) LIKE lower($1) OR lower(COALESCE(cedula,'')) LIKE lower($1))" : ""} ORDER BY nombre ASC LIMIT 50`,
          params
        );
        clienteRows = rCli.rows;
      } catch { /* columna es_proveedor pendiente de migración */ }

      const provIds = new Set(rProv.rows.map((r) => r.id));
      items = [
        ...rProv.rows.map((r) => ({ id: r.id, nombre: r.nombre, rifCi: r.rif_ci, direccion: r.direccion, telefono: r.telefono, diasCredito: Number(r.dias_credito ?? 0), fuente: "proveedor" })),
        ...clienteRows
          .filter((r) => !provIds.has(r.id))
          .map((r) => ({ id: -r.id, nombre: r.nombre, rifCi: r.cedula ?? null, direccion: r.direccion ?? null, telefono: r.telefono ?? null, diasCredito: 0, fuente: "cliente" })),
      ];
    }
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { nombre, rifCi, direccion, telefono, diasCredito } = body;
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  try {
    // Validar RIF/CI duplicado
    if (rifCi?.trim()) {
      const dupRif = await pool.query(
        `SELECT id, nombre FROM proveedores WHERE lower(rif_ci) = lower($1) LIMIT 1`,
        [rifCi.trim()]
      );
      if ((dupRif.rowCount ?? 0) > 0) {
        return NextResponse.json(
          { error: `Ya existe un proveedor con ese RIF/CI: ${dupRif.rows[0].nombre}` },
          { status: 409 }
        );
      }
    }

    const r = await pool.query(
      `INSERT INTO proveedores (nombre, rif_ci, direccion, telefono, dias_credito)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [nombre.trim(), rifCi?.trim() || null, direccion?.trim() || null, telefono?.trim() || null, Number(diasCredito) || 0]
    );
    return NextResponse.json({ id: r.rows[0].id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

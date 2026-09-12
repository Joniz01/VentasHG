import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSesionFromRequest } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  // Historial de proveedores reales a través de compras registradas
  const result = await pool.query(
    `SELECT
       pr.id                              AS proveedor_id,
       pr.nombre                          AS proveedor_nombre,
       pr.rif_ci                          AS proveedor_rif,
       pr.telefono                        AS proveedor_telefono,
       COUNT(ci.id)::int                  AS veces_comprado,
       MAX(c.fecha)                       AS ultima_compra,
       (
         SELECT ci2.costo_unit_bs
         FROM compra_items ci2
         JOIN compras c2 ON c2.id = ci2.compra_id
         WHERE ci2.producto_id = $1 AND c2.proveedor_id = pr.id
         ORDER BY c2.fecha DESC
         LIMIT 1
       )                                  AS ultimo_precio_bs
     FROM compra_items ci
     JOIN compras c  ON c.id  = ci.compra_id
     JOIN proveedores pr ON pr.id = c.proveedor_id
     WHERE ci.producto_id = $1
     GROUP BY pr.id, pr.nombre, pr.rif_ci, pr.telefono
     ORDER BY MAX(c.fecha) DESC`,
    [id]
  );

  return NextResponse.json({
    items: result.rows.map((r) => ({
      proveedorId: r.proveedor_id,
      proveedorNombre: r.proveedor_nombre,
      proveedorRif: r.proveedor_rif ?? "",
      proveedorTelefono: r.proveedor_telefono ?? "",
      vecesComprado: r.veces_comprado,
      ultimaCompra: r.ultima_compra,
      ultimoPrecioBs: r.ultimo_precio_bs ? Number(r.ultimo_precio_bs) : null,
    })),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { proveedorId, precioRefUsd, tiempoEntregaDias, esPrincipal, notas } = body;

  if (!proveedorId) return NextResponse.json({ error: "Proveedor requerido" }, { status: 400 });

  if (esPrincipal) {
    await pool.query(
      `UPDATE producto_proveedores SET es_principal = FALSE WHERE producto_id = $1`,
      [id]
    );
  }

  const result = await pool.query(
    `INSERT INTO producto_proveedores (producto_id, proveedor_id, precio_ref_usd, tiempo_entrega_dias, es_principal, notas)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (producto_id, proveedor_id) DO UPDATE
       SET precio_ref_usd = EXCLUDED.precio_ref_usd,
           tiempo_entrega_dias = EXCLUDED.tiempo_entrega_dias,
           es_principal = EXCLUDED.es_principal,
           notas = EXCLUDED.notas
     RETURNING id`,
    [
      id,
      proveedorId,
      precioRefUsd || null,
      tiempoEntregaDias || 0,
      esPrincipal ?? false,
      notas || null,
    ]
  );

  const prov = await pool.query(
    `SELECT nombre, rif_ci FROM proveedores WHERE id = $1`,
    [proveedorId]
  );

  const pp = result.rows[0];
  const p = prov.rows[0];

  return NextResponse.json(
    {
      id: pp.id,
      proveedorId,
      proveedorNombre: p?.nombre ?? "",
      proveedorRif: p?.rif_ci ?? "",
      precioRefUsd: precioRefUsd ? Number(precioRefUsd) : null,
      tiempoEntregaDias: Number(tiempoEntregaDias ?? 0),
      esPrincipal: esPrincipal ?? false,
      notas: notas ?? "",
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const sesion = await getSesionFromRequest(request);
  if (!sesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const proveedorId = searchParams.get("proveedorId");

  if (!proveedorId) return NextResponse.json({ error: "proveedorId requerido" }, { status: 400 });

  await pool.query(
    `DELETE FROM producto_proveedores WHERE producto_id = $1 AND proveedor_id = $2`,
    [id, proveedorId]
  );

  return NextResponse.json({ ok: true });
}

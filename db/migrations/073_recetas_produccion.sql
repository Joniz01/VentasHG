-- Recetas de Producción (RP) — equivalente al BOM en ERP
CREATE TABLE IF NOT EXISTS rp_items (
  id              SERIAL PRIMARY KEY,
  producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  insumo_id       INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        NUMERIC(12,4) NOT NULL CHECK (cantidad > 0),
  unidad_medida   TEXT NOT NULL DEFAULT 'unidad',
  notas           TEXT,
  orden           INTEGER NOT NULL DEFAULT 0,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rp_producto_insumo UNIQUE (producto_id, insumo_id)
);

CREATE INDEX IF NOT EXISTS idx_rp_items_producto ON rp_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_rp_items_insumo   ON rp_items(insumo_id);

-- Rendimiento por lote (cuántas unidades produce la receta completa)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS rp_rendimiento NUMERIC(12,4) DEFAULT 1
    CHECK (rp_rendimiento > 0);

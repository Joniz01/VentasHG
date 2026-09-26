-- Lotes de inventario con trazabilidad y vencimientos
CREATE TABLE IF NOT EXISTS lotes_inventario (
  id               SERIAL PRIMARY KEY,
  producto_id      INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  numero_lote      TEXT NOT NULL,
  fecha_entrada    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  cantidad_inicial NUMERIC(12,2) NOT NULL,
  cantidad_actual  NUMERIC(12,2) NOT NULL,
  compra_id        INTEGER REFERENCES compras(id),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       INTEGER REFERENCES usuarios(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_lote_producto UNIQUE (producto_id, numero_lote)
);

CREATE INDEX IF NOT EXISTS idx_lotes_producto    ON lotes_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes_inventario(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_lotes_activo      ON lotes_inventario(activo);

-- Días de alerta configurables por producto
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS dias_alerta_vencimiento INTEGER DEFAULT 7;

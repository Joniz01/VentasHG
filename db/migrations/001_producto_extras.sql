CREATE TABLE IF NOT EXISTS producto_extras (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  precio_adicional NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producto_extras_producto_id ON producto_extras(producto_id);

ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS extra_id INTEGER REFERENCES producto_extras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS extra_nombre TEXT,
  ADD COLUMN IF NOT EXISTS extra_precio NUMERIC(12, 2) NOT NULL DEFAULT 0;

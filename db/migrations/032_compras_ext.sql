-- Días de crédito en proveedores
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS dias_credito INTEGER NOT NULL DEFAULT 0;

-- Fecha de vencimiento de pago en compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS fecha_vencimiento_pago DATE;

-- Recepciones de mercancía (sin factura aún)
CREATE TABLE IF NOT EXISTS recepciones (
  id               SERIAL PRIMARY KEY,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor_id     INTEGER REFERENCES proveedores(id),
  proveedor_nombre TEXT NOT NULL,
  observaciones    TEXT,
  estado           TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','RELACIONADA')),
  compra_id        INTEGER REFERENCES compras(id),
  created_by       INTEGER REFERENCES usuarios(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recepcion_items (
  id              SERIAL PRIMARY KEY,
  recepcion_id    INTEGER NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
  producto_id     INTEGER REFERENCES productos(id),
  nombre_producto TEXT NOT NULL,
  cantidad        NUMERIC(12,2) NOT NULL,
  costo_unit_bs   NUMERIC(12,2)
);

CREATE INDEX IF NOT EXISTS idx_recepciones_estado ON recepciones(estado);
CREATE INDEX IF NOT EXISTS idx_recepciones_proveedor ON recepciones(proveedor_id);

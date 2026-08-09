-- Agrega tipo de uso a facturas de compra: VENTA o MATERIA_PRIMA
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS tipo_uso TEXT NOT NULL DEFAULT 'VENTA'
    CHECK (tipo_uso IN ('VENTA', 'MATERIA_PRIMA'));

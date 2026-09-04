-- Permite que ítems individuales de una factura de compra difieran del
-- tipo de uso general de la factura (ej. factura "Para venta" con 1 o 2
-- productos que en realidad son materia prima, o viceversa).
ALTER TABLE compra_items
  ADD COLUMN IF NOT EXISTS tipo_uso TEXT NOT NULL DEFAULT 'VENTA'
    CHECK (tipo_uso IN ('VENTA', 'MATERIA_PRIMA'));

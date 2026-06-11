-- Permite que el motorizado marque que aceptó/tomó el pedido antes de entregarlo.

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS pedido_aceptado BOOLEAN NOT NULL DEFAULT FALSE;

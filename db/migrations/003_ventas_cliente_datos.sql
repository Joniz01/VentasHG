-- Datos adicionales del cliente y soporte para edición de ventas

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS cliente_ci TEXT;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS direccion TEXT;

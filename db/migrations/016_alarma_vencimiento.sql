ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS alarma_vencimiento_silenciada_hasta TIMESTAMPTZ;

-- Fase 1: mínimos de stock, unidad de medida y control de alerta outstock

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidad_medida TEXT NOT NULL DEFAULT 'unidad',
  ADD COLUMN IF NOT EXISTS alerta_outstock_desactivada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alerta_outstock_motivo TEXT;

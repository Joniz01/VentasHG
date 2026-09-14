-- Reglas de reorden: cantidad a pedir cuando se alcanza el stock mínimo
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS cantidad_reorden NUMERIC(12,2) DEFAULT NULL;

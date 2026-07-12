-- Categorización de productos: Para la Venta y/o Materia Prima
-- Ejecutar manualmente en Neon SQL Editor

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS es_venta        BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS es_materia_prima BOOLEAN NOT NULL DEFAULT FALSE;

-- Los productos existentes se marcan como "Para la Venta" por default (ya lo son).
-- Actualizar manualmente los que sean solo Materia Prima:
-- UPDATE productos SET es_venta = FALSE, es_materia_prima = TRUE WHERE nombre ILIKE '%harina%';

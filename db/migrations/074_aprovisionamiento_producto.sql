-- Tipo de aprovisionamiento: cómo se obtiene el producto
-- COMPRA = se adquiere de proveedor (default)
-- FABRICACION = se produce internamente, requiere Receta de Producción (RP)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS aprovisionamiento TEXT NOT NULL DEFAULT 'COMPRA'
    CHECK (aprovisionamiento IN ('COMPRA', 'FABRICACION'));

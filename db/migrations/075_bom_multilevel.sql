-- Fase 6b: BOM multi-nivel
-- subtipo_fabricacion en productos (RECETA_BASE, ENSAMBLADO, COMPUESTO)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS subtipo_fabricacion TEXT
    CHECK (subtipo_fabricacion IN ('RECETA_BASE', 'ENSAMBLADO', 'COMPUESTO'));

-- factor_merma por línea de receta (>= 1.0, ej: 1.08 = 8% de merma)
ALTER TABLE rp_items
  ADD COLUMN IF NOT EXISTS factor_merma NUMERIC(5,4) NOT NULL DEFAULT 1.0
    CHECK (factor_merma >= 1.0);

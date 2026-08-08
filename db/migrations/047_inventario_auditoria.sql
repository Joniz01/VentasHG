-- Fase 3: trazabilidad de quién realizó cada movimiento de inventario

ALTER TABLE inventario_movimientos
  ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'MANUAL'
    CHECK (origen IN ('MANUAL', 'VENTA', 'CONTEO'));

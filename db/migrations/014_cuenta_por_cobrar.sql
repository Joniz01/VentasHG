ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS cuenta_por_cobrar BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_limite_pago DATE,
  ADD COLUMN IF NOT EXISTS cuenta_cobrada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cuenta_cobrada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ventas_cuenta_por_cobrar
  ON ventas (cuenta_por_cobrar, cuenta_cobrada);

-- Caché local de tasas BCV por fecha, para no depender de APIs externas en cada consulta
CREATE TABLE IF NOT EXISTS tasas_bcv_historico (
  fecha DATE PRIMARY KEY,
  tasa NUMERIC(12,4) NOT NULL,
  fuente TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

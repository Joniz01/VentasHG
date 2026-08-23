-- Día de la semana para nóminas automáticas (0=domingo … 6=sábado)
-- Solo relevante cuando modo_generacion = 'AUTOMATICO'
ALTER TABLE nominas
  ADD COLUMN IF NOT EXISTS dia_semana SMALLINT CHECK (dia_semana BETWEEN 0 AND 6);

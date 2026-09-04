-- Días calendario de pago para nóminas automáticas
-- MENSUAL: dia_pago_1 (ej. 15)
-- QUINCENAL: dia_pago_1 y dia_pago_2 (ej. 15 y 30)
-- SEMANAL: usa la columna dia_semana existente
ALTER TABLE nominas
  ADD COLUMN IF NOT EXISTS dia_pago_1 SMALLINT CHECK (dia_pago_1 BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS dia_pago_2 SMALLINT CHECK (dia_pago_2 BETWEEN 1 AND 31);

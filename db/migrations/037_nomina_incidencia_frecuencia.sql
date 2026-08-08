-- Frecuencia propia de cada incidencia asignada a un pago de nómina
-- (independiente de la frecuencia del período: Semanal/Quincenal/Mensual del período
--  vs. Semanal/Quincenal/Mensual/Bimensual/Trimestral/Semestral/Anual de la incidencia)
ALTER TABLE nomina_incidencias ADD COLUMN IF NOT EXISTS frecuencia TEXT
  CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL','BIMENSUAL','TRIMESTRAL','SEMESTRAL','ANUAL'));

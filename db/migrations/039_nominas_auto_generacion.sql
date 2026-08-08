-- Modo de generación por Nómina: manual (el usuario presiona "Generar Período",
-- con fechas ya sugeridas) o automático (un cron diario la genera sola).
ALTER TABLE nominas ADD COLUMN IF NOT EXISTS modo_generacion TEXT NOT NULL DEFAULT 'MANUAL'
  CHECK (modo_generacion IN ('MANUAL','AUTOMATICO'));

-- Nuevo tipo de Nómina: Solo Sueldo Base (excluye incidencias, lo opuesto a
-- "Solo incidencias" que excluye el sueldo).
ALTER TABLE nominas DROP CONSTRAINT IF EXISTS nominas_tipo_check;
ALTER TABLE nominas ADD CONSTRAINT nominas_tipo_check
  CHECK (tipo IN ('NORMAL','SOLO_INCIDENCIAS','SOLO_SUELDO'));

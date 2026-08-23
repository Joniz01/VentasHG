-- Activa/desactiva la generación automática de períodos de nómina por el cron diario
INSERT INTO configuracion (clave, valor) VALUES ('nomina_auto_generar', 'false')
  ON CONFLICT (clave) DO NOTHING;

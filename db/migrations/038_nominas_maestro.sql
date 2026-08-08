-- Nóminas como valor maestro (antes cada "período" se creaba suelto con una
-- frecuencia que debía coincidir con el tipo de pago del empleado). Ahora una
-- Nómina es una entidad con nombre propia, a la que se le asignan empleados
-- (relación muchos-a-muchos) y que puede excluir el sueldo base (solo incidencias).
CREATE TABLE IF NOT EXISTS nominas (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  tipo       TEXT NOT NULL DEFAULT 'NORMAL' CHECK (tipo IN ('NORMAL','SOLO_INCIDENCIAS')),
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL')),
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asignación de empleados a una o varias Nóminas (reemplaza el match por tipo_pago)
CREATE TABLE IF NOT EXISTS empleado_nominas (
  empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
  nomina_id   INTEGER NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
  PRIMARY KEY (empleado_id, nomina_id)
);

CREATE INDEX IF NOT EXISTS idx_empleado_nominas_nomina ON empleado_nominas (nomina_id);

-- El tipo de pago del empleado ya no es obligatorio: ahora se asigna vía Nóminas
ALTER TABLE empleados ALTER COLUMN tipo_pago DROP NOT NULL;

-- Configuración de incidencias propia de cada Nómina (plantilla): cada una define
-- su propia frecuencia y fecha efectiva, con monto en $ + Bs calculado con la tasa
-- vigente al configurarla.
CREATE TABLE IF NOT EXISTS nomina_incidencia_config (
  id                 SERIAL PRIMARY KEY,
  nomina_id          INTEGER NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
  tipo_incidencia_id INTEGER NOT NULL REFERENCES tipos_incidencia(id),
  frecuencia         TEXT NOT NULL CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL','BIMENSUAL','TRIMESTRAL','SEMESTRAL','ANUAL')),
  fecha_efectiva     DATE NOT NULL,
  monto_usd          NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_bs           NUMERIC(12,2) NOT NULL DEFAULT 0,
  tasa_registro      NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nomina_incidencia_config_nomina ON nomina_incidencia_config (nomina_id);

-- Los períodos ahora son "corridas" de una Nómina maestra
ALTER TABLE periodos_nomina ADD COLUMN IF NOT EXISTS nomina_id INTEGER REFERENCES nominas(id);
CREATE INDEX IF NOT EXISTS idx_periodos_nomina_nomina ON periodos_nomina (nomina_id);

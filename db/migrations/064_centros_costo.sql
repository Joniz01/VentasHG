-- Maestro de Centros de Costo
CREATE TABLE IF NOT EXISTS centros_costo (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT    NOT NULL,
  descripcion TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT centros_costo_nombre_uq UNIQUE (nombre)
);

-- Asociar a nóminas
ALTER TABLE nominas
  ADD COLUMN IF NOT EXISTS centro_costo_id INTEGER REFERENCES centros_costo(id);

-- Asociar a gastos
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS centro_costo_id INTEGER REFERENCES centros_costo(id);

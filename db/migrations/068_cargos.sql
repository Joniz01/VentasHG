-- Maestro de cargos para empleados
CREATE TABLE IF NOT EXISTS cargos (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  descripcion TEXT,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cargos_nombre_uq UNIQUE (nombre)
);

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cargo_id INTEGER REFERENCES cargos(id);

-- Categorías y catálogo de extras (cambios incrementales sobre producto_extras y productos)

CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

INSERT INTO categorias (nombre) VALUES
  ('Queso'),
  ('Premium'),
  ('Especiales'),
  ('Masas Intervenidas'),
  ('Combos y Pack'),
  ('Raciones')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS extras_catalogo (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

INSERT INTO extras_catalogo (nombre) VALUES ('Frito')
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias(id);

ALTER TABLE producto_extras
  ADD COLUMN IF NOT EXISTS extra_id INTEGER REFERENCES extras_catalogo(id);

ALTER TABLE producto_extras
  DROP COLUMN IF EXISTS nombre;

ALTER TABLE producto_extras
  ALTER COLUMN extra_id SET NOT NULL;

ALTER TABLE producto_extras
  ADD CONSTRAINT uq_producto_extra UNIQUE (producto_id, extra_id);

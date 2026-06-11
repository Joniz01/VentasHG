-- Catálogo de clientes para reutilizar datos entre ventas

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT UNIQUE,
  direccion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas eficientes por prefijo (nombre o cédula)
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (lower(nombre) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes (lower(cedula) text_pattern_ops);

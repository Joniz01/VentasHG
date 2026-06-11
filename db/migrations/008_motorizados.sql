-- Soporte para motorizados (delivery): usuarios, sesiones, asignación y estado ENVIADO

CREATE TABLE IF NOT EXISTS motorizados (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motorizado_sesiones (
  token TEXT PRIMARY KEY,
  motorizado_id INTEGER NOT NULL REFERENCES motorizados(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS motorizado_id INTEGER REFERENCES motorizados(id),
  ADD COLUMN IF NOT EXISTS pedido_enviado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ventas_motorizado_id ON ventas (motorizado_id);

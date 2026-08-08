-- Fase 4: usuarios de conteo de inventario (autenticación ligera, similar a motorizados)

CREATE TABLE IF NOT EXISTS conteo_usuarios (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  usuario    TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conteo_sesiones (
  id                SERIAL PRIMARY KEY,
  token             TEXT NOT NULL UNIQUE,
  conteo_usuario_id INTEGER NOT NULL REFERENCES conteo_usuarios(id) ON DELETE CASCADE,
  expires_at        TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

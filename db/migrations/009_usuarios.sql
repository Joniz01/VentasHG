-- Usuarios del sistema con roles y permisos por sección,
-- en reemplazo de la contraseña única compartida.

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'USUARIO' CHECK (rol IN ('ADMIN', 'USUARIO')),
  ve_productos BOOLEAN NOT NULL DEFAULT FALSE,
  ve_ventas BOOLEAN NOT NULL DEFAULT FALSE,
  ve_reportes BOOLEAN NOT NULL DEFAULT FALSE,
  ve_pedidos_pendientes BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sesiones
  ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;

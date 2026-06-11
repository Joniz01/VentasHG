-- Configuración de acceso al sistema (contraseña de administración)

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sesiones activas para el acceso protegido por contraseña
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

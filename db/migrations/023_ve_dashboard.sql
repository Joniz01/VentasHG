ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ve_dashboard BOOLEAN NOT NULL DEFAULT FALSE;

-- Los usuarios ADMIN existentes obtienen el permiso automáticamente
UPDATE usuarios SET ve_dashboard = TRUE WHERE rol = 'ADMIN';

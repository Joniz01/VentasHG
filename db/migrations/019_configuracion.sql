CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Valor por defecto: 7 días de retención de imágenes
INSERT INTO configuracion (clave, valor) VALUES ('imagen_retencion_dias', '7')
  ON CONFLICT (clave) DO NOTHING;

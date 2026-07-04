-- Permiso de descuento en usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ve_descuento BOOLEAN NOT NULL DEFAULT FALSE;

-- Descuento porcentaje y tipo de delivery en ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_delivery TEXT;

-- Nuevas claves de configuración
INSERT INTO configuracion (clave, valor) VALUES ('modo_entrega_default', 'DELIVERY')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('wink_costo_default', '3')
  ON CONFLICT (clave) DO NOTHING;

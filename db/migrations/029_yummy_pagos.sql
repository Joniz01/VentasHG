-- Tabla para pagos Yummy (cuenta por cobrar simple con días de vencimiento)
CREATE TABLE IF NOT EXISTS yummy_pagos (
  venta_id        INTEGER PRIMARY KEY REFERENCES ventas(id) ON DELETE CASCADE,
  monto           DECIMAL(12,2) NOT NULL,
  dias            INTEGER NOT NULL DEFAULT 2,
  fecha_vencimiento DATE NOT NULL,
  liquidado       BOOLEAN NOT NULL DEFAULT FALSE,
  liquidado_at    TIMESTAMPTZ
);

-- Config keys por default
INSERT INTO configuracion (clave, valor) VALUES
  ('yummy_dias', '2,3,4,5'),
  ('yummy_dias_default', '2')
ON CONFLICT (clave) DO NOTHING;

-- Datos de pago Cashea por venta
CREATE TABLE IF NOT EXISTS cashea_pagos (
  venta_id          INT PRIMARY KEY REFERENCES ventas(id) ON DELETE CASCADE,
  porcentaje        DECIMAL(5,2) NOT NULL,
  monto_inicial     DECIMAL(12,2) NOT NULL,
  monto_financiado  DECIMAL(12,2) NOT NULL,
  dias              INT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  liquidado         BOOLEAN NOT NULL DEFAULT FALSE,
  liquidado_at      TIMESTAMPTZ,
  alarma_silenciada_hasta TIMESTAMPTZ
);

-- Configuración de opciones Cashea
INSERT INTO configuracion (clave, valor) VALUES ('cashea_porcentajes', '40,50,60')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_porcentaje_default', '50')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_dias', '15,30')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_dias_default', '15')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('cashea_vencimiento_hora', '09:00')
  ON CONFLICT (clave) DO NOTHING;

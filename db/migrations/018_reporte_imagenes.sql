-- Una imagen por rango de fechas; se reemplaza si se sube otra del mismo día
CREATE TABLE IF NOT EXISTS reporte_imagenes (
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (desde, hasta)
);

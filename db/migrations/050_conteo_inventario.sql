-- Fase 4: tablas de toma de inventario físico

CREATE TABLE IF NOT EXISTS conteo_inventario (
  id                SERIAL PRIMARY KEY,
  conteo_usuario_id INTEGER REFERENCES conteo_usuarios(id),
  estado            TEXT NOT NULL DEFAULT 'BORRADOR'
                      CHECK (estado IN ('BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO')),
  nota              TEXT,
  aprobado_por      INTEGER REFERENCES usuarios(id),
  aprobado_at       TIMESTAMPTZ,
  nota_supervisor   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conteo_inventario_items (
  id              SERIAL PRIMARY KEY,
  conteo_id       INTEGER NOT NULL REFERENCES conteo_inventario(id) ON DELETE CASCADE,
  producto_id     INTEGER NOT NULL REFERENCES productos(id),
  stock_sistema   NUMERIC(12,2) NOT NULL,
  stock_contado   NUMERIC(12,2) NOT NULL,
  stock_corregido NUMERIC(12,2),
  corregido_por   INTEGER REFERENCES usuarios(id),
  corregido_at    TIMESTAMPTZ,
  nota            TEXT,
  UNIQUE(conteo_id, producto_id)
);

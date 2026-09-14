-- Migration 076: Órdenes de Producción
-- Apply manually in Neon SQL editor

CREATE TABLE IF NOT EXISTS ordenes_produccion (
  id                  SERIAL PRIMARY KEY,
  producto_id         INTEGER NOT NULL REFERENCES productos(id),
  cantidad_planificada NUMERIC(12,4) NOT NULL CHECK (cantidad_planificada > 0),
  cantidad_producida   NUMERIC(12,4) NOT NULL DEFAULT 0,
  estado              TEXT NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE','EN_PROCESO','COMPLETADA','CANCELADA')),
  fecha_planificada   DATE,
  fecha_inicio        TIMESTAMP,
  fecha_fin           TIMESTAMP,
  notas               TEXT,
  created_at          TIMESTAMP NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS op_consumos (
  id                   SERIAL PRIMARY KEY,
  orden_id             INTEGER NOT NULL REFERENCES ordenes_produccion(id) ON DELETE CASCADE,
  insumo_id            INTEGER NOT NULL REFERENCES productos(id),
  cantidad_planificada NUMERIC(12,4) NOT NULL,
  cantidad_consumida   NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_estado       ON ordenes_produccion(estado);
CREATE INDEX IF NOT EXISTS idx_op_producto     ON ordenes_produccion(producto_id);
CREATE INDEX IF NOT EXISTS idx_op_consumos_ord ON op_consumos(orden_id);

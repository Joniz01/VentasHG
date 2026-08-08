-- Migración 052: tabla de empaques por producto
-- Permite declarar que un producto (unidad de venta) puede obtenerse
-- abriendo un empaque (producto padre), con un rendimiento determinado.

CREATE TABLE IF NOT EXISTS producto_empaques (
  id           SERIAL PRIMARY KEY,
  unidad_id    INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  empaque_id   INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  rendimiento  INTEGER NOT NULL CHECK (rendimiento > 0),
  prioridad    INTEGER NOT NULL DEFAULT 1,
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (unidad_id, empaque_id)
);

-- Nuevo valor de origen para inventario_movimientos (documentativo — la columna es TEXT)
-- 'APERTURA_EMPAQUE' se usará al registrar la apertura de un empaque

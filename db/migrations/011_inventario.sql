-- Inventario de productos (bandejas), combos/packs y "Bandeja Variada"

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS tipo_producto TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (tipo_producto IN ('NORMAL', 'COMBO', 'VARIADA')),
  ADD COLUMN IF NOT EXISTS stock_actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variada_raciones INTEGER NOT NULL DEFAULT 0;

-- Historial de movimientos de inventario (entradas, ajustes y descuentos por venta)
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'AJUSTE', 'VENTA')),
  cantidad NUMERIC(12, 2) NOT NULL,
  nota TEXT,
  venta_id INTEGER REFERENCES ventas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_producto_id ON inventario_movimientos(producto_id);
CREATE INDEX IF NOT EXISTS idx_inventario_movimientos_venta_id ON inventario_movimientos(venta_id);

-- Componentes (bandejas) que conforman un combo/pack y la cantidad a descontar por unidad vendida
CREATE TABLE IF NOT EXISTS producto_componentes (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  componente_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad NUMERIC(12, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_producto_componente UNIQUE (producto_id, componente_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_componentes_producto_id ON producto_componentes(producto_id);

-- Raciones seleccionadas por el operador para un item "Bandeja Variada"
CREATE TABLE IF NOT EXISTS venta_item_variada (
  id SERIAL PRIMARY KEY,
  venta_item_id INTEGER NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12, 2) NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_venta_item_variada_venta_item_id ON venta_item_variada(venta_item_id);

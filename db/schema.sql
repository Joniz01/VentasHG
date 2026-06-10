-- Esquema de base de datos para VentasHG

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE metodo_pago AS ENUM (
    'PUNTO_VENTA',
    'TRANSFERENCIA',
    'PAGO_MOVIL',
    'EFECTIVO_BS',
    'EFECTIVO_USD',
    'ZELLE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE modo_entrega AS ENUM ('LOCAL', 'DELIVERY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tasa_dia NUMERIC(12, 4) NOT NULL DEFAULT 0,
  cliente TEXT NOT NULL,
  modalidad_compra TEXT,
  modo_entrega modo_entrega NOT NULL DEFAULT 'LOCAL',
  costo_delivery NUMERIC(12, 2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venta_items (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12, 2) NOT NULL,
  costo_unit NUMERIC(12, 2) NOT NULL,
  precio_unit NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS pagos_venta (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  metodo metodo_pago NOT NULL,
  monto NUMERIC(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venta_items_venta_id ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_pagos_venta_venta_id ON pagos_venta(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto_id ON venta_items(producto_id);

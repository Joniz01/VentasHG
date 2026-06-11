-- Esquema de base de datos para VentasHG

-- Catálogo de clientes para reutilizar datos entre ventas
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT UNIQUE,
  direccion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (lower(nombre) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes (lower(cedula) text_pattern_ops);

-- Categorías preconfiguradas de productos
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

INSERT INTO categorias (nombre) VALUES
  ('Queso'),
  ('Premium'),
  ('Especiales'),
  ('Masas Intervenidas'),
  ('Combos y Pack'),
  ('Raciones')
ON CONFLICT (nombre) DO NOTHING;

-- Catálogo global de extras/presentaciones (ej: "Frito")
CREATE TABLE IF NOT EXISTS extras_catalogo (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

INSERT INTO extras_catalogo (nombre) VALUES ('Frito')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  costo NUMERIC(12, 2) NOT NULL DEFAULT 0,
  precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  categoria_id INTEGER REFERENCES categorias(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extras/presentaciones adicionales asignados a un producto, con precio adicional propio
CREATE TABLE IF NOT EXISTS producto_extras (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  extra_id INTEGER NOT NULL REFERENCES extras_catalogo(id),
  precio_adicional NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_producto_extra UNIQUE (producto_id, extra_id)
);

CREATE INDEX IF NOT EXISTS idx_producto_extras_producto_id ON producto_extras(producto_id);

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
  cliente_ci TEXT,
  direccion TEXT,
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
  precio_unit NUMERIC(12, 2) NOT NULL,
  extra_id INTEGER REFERENCES producto_extras(id) ON DELETE SET NULL,
  extra_nombre TEXT,
  extra_precio NUMERIC(12, 2) NOT NULL DEFAULT 0
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

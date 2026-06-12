-- Esquema de base de datos para VentasHG

-- Configuración general del sistema (clave/valor)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Usuarios del sistema con roles y permisos por sección
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'USUARIO' CHECK (rol IN ('ADMIN', 'USUARIO')),
  ve_productos BOOLEAN NOT NULL DEFAULT FALSE,
  ve_ventas BOOLEAN NOT NULL DEFAULT FALSE,
  ve_reportes BOOLEAN NOT NULL DEFAULT FALSE,
  ve_pedidos_pendientes BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones activas para el acceso protegido por usuario
CREATE TABLE IF NOT EXISTS sesiones (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Catálogo de clientes para reutilizar datos entre ventas
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cedula TEXT UNIQUE,
  direccion TEXT,
  telefono TEXT,
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
  tipo_producto TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (tipo_producto IN ('NORMAL', 'COMBO', 'VARIADA')),
  stock_actual NUMERIC(12, 2) NOT NULL DEFAULT 0,
  variada_raciones INTEGER NOT NULL DEFAULT 0,
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

-- Usuarios motorizados (delivery) y sus sesiones
CREATE TABLE IF NOT EXISTS motorizados (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT,
  telefono TEXT,
  usuario TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS motorizado_sesiones (
  token TEXT PRIMARY KEY,
  motorizado_id INTEGER NOT NULL REFERENCES motorizados(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tasa_dia NUMERIC(12, 4) NOT NULL DEFAULT 0,
  cliente TEXT NOT NULL,
  cliente_ci TEXT,
  cliente_telefono TEXT,
  direccion TEXT,
  modalidad_compra TEXT,
  modo_entrega modo_entrega NOT NULL DEFAULT 'LOCAL',
  costo_delivery NUMERIC(12, 2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  despacho_pendiente BOOLEAN NOT NULL DEFAULT FALSE,
  hora_entrega TIMESTAMPTZ,
  hora_preparacion TIMESTAMPTZ,
  delivery_asignado TEXT,
  motorizado_id INTEGER REFERENCES motorizados(id),
  pedido_aceptado BOOLEAN NOT NULL DEFAULT FALSE,
  pedido_entregado BOOLEAN NOT NULL DEFAULT FALSE,
  pedido_enviado BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_pagado BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_pagado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ventas_pedidos_pendientes
  ON ventas (despacho_pendiente, pedido_entregado);

CREATE INDEX IF NOT EXISTS idx_ventas_delivery_pagado
  ON ventas (despacho_pendiente, delivery_pagado);

CREATE INDEX IF NOT EXISTS idx_ventas_motorizado_id ON ventas (motorizado_id);

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

-- Raciones seleccionadas por el operador para un item "Bandeja Variada"
CREATE TABLE IF NOT EXISTS venta_item_variada (
  id SERIAL PRIMARY KEY,
  venta_item_id INTEGER NOT NULL REFERENCES venta_items(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad NUMERIC(12, 2) NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_venta_item_variada_venta_item_id ON venta_item_variada(venta_item_id);

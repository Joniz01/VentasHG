-- Sección Promociones en Ventas: descuento %, precio fijo, o producto
-- adicional sin costo, aplicables automáticamente al vender el producto
-- en promoción. Se pueden pausar/reactivar sin perder su configuración.
CREATE TABLE IF NOT EXISTS promociones (
  id                 SERIAL PRIMARY KEY,
  nombre             TEXT NOT NULL,
  tipo               TEXT NOT NULL CHECK (tipo IN ('DESCUENTO_PORCENTAJE', 'PRECIO_FIJO', 'PRODUCTO_GRATIS')),
  producto_id        INTEGER NOT NULL REFERENCES productos(id),
  valor_porcentaje   NUMERIC(5,2),
  precio_fijo_usd    NUMERIC(12,2),
  producto_gratis_id INTEGER REFERENCES productos(id),
  cantidad_gratis    NUMERIC(12,2),
  fecha_inicio       DATE,
  fecha_fin          DATE,
  activa             BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         INTEGER REFERENCES usuarios(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promociones_producto ON promociones (producto_id) WHERE activa = TRUE;
CREATE INDEX IF NOT EXISTS idx_promociones_activa ON promociones (activa);

-- Permiso para crear/editar/pausar promociones (Configuración de usuarios).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ve_promociones BOOLEAN NOT NULL DEFAULT FALSE;

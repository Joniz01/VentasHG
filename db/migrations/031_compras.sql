-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  rif_ci    TEXT,
  direccion TEXT,
  telefono  TEXT,
  activo    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores (lower(nombre) text_pattern_ops);

-- Compras / Facturas
CREATE TABLE IF NOT EXISTS compras (
  id               SERIAL PRIMARY KEY,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor_id     INTEGER REFERENCES proveedores(id),
  proveedor_nombre TEXT NOT NULL,
  proveedor_rif    TEXT,
  numero_factura   TEXT,
  observaciones    TEXT,
  tasa_dia         NUMERIC(12,4) NOT NULL DEFAULT 0,
  estado           TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA','ANULADA')),
  anulada_at       TIMESTAMPTZ,
  imagen_factura   TEXT,
  created_by       INTEGER REFERENCES usuarios(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha    ON compras (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_estado   ON compras (estado);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras (proveedor_id);

-- Items de compra
CREATE TABLE IF NOT EXISTS compra_items (
  id            SERIAL PRIMARY KEY,
  compra_id     INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id   INTEGER REFERENCES productos(id),
  nombre_producto TEXT NOT NULL,
  cantidad      NUMERIC(12,2) NOT NULL,
  costo_unit_bs NUMERIC(12,2) NOT NULL,
  subtotal_bs   NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compra_items_compra_id ON compra_items(compra_id);

-- Permiso compras en tabla usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ve_compras BOOLEAN NOT NULL DEFAULT FALSE;

-- Prompt OCR de facturas de compra (editable desde admin)
INSERT INTO configuracion (clave, valor) VALUES (
  'compras_ocr_prompt',
  'Extrae de esta imagen de factura de compra la siguiente información en formato JSON válido, sin markdown, solo JSON puro:
{
  "proveedor": { "nombre": "...", "rif": "...", "direccion": "..." },
  "numero_factura": "...",
  "fecha": "YYYY-MM-DD o null",
  "items": [
    { "nombre": "...", "cantidad": 0, "costo_unitario_bs": 0 }
  ],
  "total_bs": 0
}
Instrucciones: En facturas venezolanas, debajo de la palabra SENIAT generalmente aparece el RIF o Cédula del proveedor (inicia con V- o J-), seguido del nombre del proveedor y luego la dirección (puede ocupar varias líneas hasta llegar a datos como CI/RIF del cliente o CLIENTE:). Extrae esos datos para el objeto "proveedor". Si la factura no tiene línea de cantidad explícita para un ítem, asume cantidad 1. Los montos deben ser numéricos sin símbolo de moneda (reemplaza comas decimales por punto). Si un campo no es legible, usa null.'
) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

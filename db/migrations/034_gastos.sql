-- Permiso de acceso al módulo de Gastos
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ve_gastos BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE usuarios SET ve_gastos = TRUE WHERE rol = 'ADMIN';

-- Locaciones (sedes) reutilizables en Gastos, Compras y Nómina
CREATE TABLE IF NOT EXISTS locaciones (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO locaciones (nombre) VALUES ('Margarita'), ('Caracas')
  ON CONFLICT (nombre) DO NOTHING;

-- Tipos de gasto (catálogo configurable: Materia Prima, Operativo + los que se agreguen)
CREATE TABLE IF NOT EXISTS tipos_gasto (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tipos_gasto (nombre) VALUES ('Gasto Materia Prima'), ('Gasto Operativo')
  ON CONFLICT (nombre) DO NOTHING;

-- Gastos: Materia Prima, Operativo y los tipos que se agreguen desde el catálogo
CREATE TABLE IF NOT EXISTS gastos (
  id                 SERIAL PRIMARY KEY,
  tipo_gasto_id      INTEGER NOT NULL REFERENCES tipos_gasto(id),
  tipo               TEXT NOT NULL CHECK (tipo IN ('FIJO','OCASIONAL')),
  proveedor          TEXT NOT NULL,
  descripcion        TEXT,
  locacion_id        INTEGER REFERENCES locaciones(id),
  fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
  monto_bs           NUMERIC(12,2) NOT NULL DEFAULT 0,
  tasa_dia           NUMERIC(12,4) NOT NULL DEFAULT 0,
  estado             TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','APROBADO','PAGADO')),
  pagado_at          TIMESTAMPTZ,
  comprobante_url    TEXT,
  recurrente         BOOLEAN NOT NULL DEFAULT FALSE,
  frecuencia         TEXT CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL')),
  proximo_recordatorio DATE,
  recordatorio_visto BOOLEAN NOT NULL DEFAULT FALSE,
  created_by         INTEGER REFERENCES usuarios(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo_gasto ON gastos (tipo_gasto_id);
CREATE INDEX IF NOT EXISTS idx_gastos_proveedor ON gastos (lower(proveedor) text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_gastos_recordatorio ON gastos (proximo_recordatorio) WHERE recurrente = TRUE;

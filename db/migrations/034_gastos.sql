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

-- Gastos: Materia Prima y Operación
CREATE TABLE IF NOT EXISTS gastos (
  id                 SERIAL PRIMARY KEY,
  categoria          TEXT NOT NULL CHECK (categoria IN ('MATERIA_PRIMA','OPERACION')),
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
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON gastos (categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_recordatorio ON gastos (proximo_recordatorio) WHERE recurrente = TRUE;

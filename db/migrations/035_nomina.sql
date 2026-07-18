-- Empleados (ficha maestra)
CREATE TABLE IF NOT EXISTS empleados (
  id             SERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  cargo          TEXT,
  locacion_id    INTEGER REFERENCES locaciones(id),
  tipo_pago      TEXT NOT NULL CHECK (tipo_pago IN ('SEMANAL','QUINCENAL','MENSUAL')),
  salario_base_bs NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_ingreso  DATE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empleados_activo ON empleados (activo);

-- Catálogo configurable de incidencias (Cesta Ticket, Seguro Social, Pensión + las que se agreguen)
CREATE TABLE IF NOT EXISTS tipos_incidencia (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tipos_incidencia (nombre) VALUES ('Cesta Ticket'), ('Seguro Social (IVSS)'), ('Pensión')
  ON CONFLICT (nombre) DO NOTHING;

-- Períodos de nómina (Semanal / Quincenal / Mensual)
CREATE TABLE IF NOT EXISTS periodos_nomina (
  id           SERIAL PRIMARY KEY,
  frecuencia   TEXT NOT NULL CHECK (frecuencia IN ('SEMANAL','QUINCENAL','MENSUAL')),
  fecha_desde  DATE NOT NULL,
  fecha_hasta  DATE NOT NULL,
  tasa_dia     NUMERIC(12,4) NOT NULL DEFAULT 0,
  estado       TEXT NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO','CERRADO')),
  created_by   INTEGER REFERENCES usuarios(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_periodos_nomina_fecha ON periodos_nomina (fecha_desde DESC);

-- Pago de nómina por empleado dentro de un período
CREATE TABLE IF NOT EXISTS nomina_pagos (
  id              SERIAL PRIMARY KEY,
  periodo_id      INTEGER NOT NULL REFERENCES periodos_nomina(id) ON DELETE CASCADE,
  empleado_id     INTEGER NOT NULL REFERENCES empleados(id),
  salario_base_bs NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PAGADO')),
  pagado_at       TIMESTAMPTZ,
  UNIQUE (periodo_id, empleado_id)
);

CREATE INDEX IF NOT EXISTS idx_nomina_pagos_periodo ON nomina_pagos (periodo_id);
CREATE INDEX IF NOT EXISTS idx_nomina_pagos_empleado ON nomina_pagos (empleado_id);

-- Incidencias asignadas a cada pago de nómina (por empleado)
CREATE TABLE IF NOT EXISTS nomina_incidencias (
  id                SERIAL PRIMARY KEY,
  nomina_pago_id    INTEGER NOT NULL REFERENCES nomina_pagos(id) ON DELETE CASCADE,
  tipo_incidencia_id INTEGER NOT NULL REFERENCES tipos_incidencia(id),
  monto_bs          NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nomina_incidencias_pago ON nomina_incidencias (nomina_pago_id);

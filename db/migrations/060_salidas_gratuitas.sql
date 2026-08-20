-- Recrea el esquema de "Salida Cortesías" (salidas gratuitas de inventario:
-- cortesías, sorteos, consumo interno, eventos, fidelidad). El código de esta
-- función se había eliminado del repo por error (commit 11b251d); esta
-- migración es idempotente por si la tabla ya existía manualmente en la BD.
CREATE TABLE IF NOT EXISTS salidas_gratuitas (
  id                 SERIAL PRIMARY KEY,
  tipo               TEXT NOT NULL,
  fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
  beneficiario       TEXT,
  motivo             TEXT,
  usuario_id         INTEGER REFERENCES usuarios(id),
  anulada            BOOLEAN NOT NULL DEFAULT FALSE,
  anulada_at         TIMESTAMPTZ,
  anulada_usuario_id INTEGER REFERENCES usuarios(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salidas_gratuitas_items (
  id          SERIAL PRIMARY KEY,
  salida_id   INTEGER NOT NULL REFERENCES salidas_gratuitas(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad    NUMERIC(12,2) NOT NULL,
  costo       NUMERIC(12,4) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_salidas_gratuitas_fecha ON salidas_gratuitas (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_salidas_gratuitas_tipo ON salidas_gratuitas (tipo);
CREATE INDEX IF NOT EXISTS idx_salidas_gratuitas_items_salida ON salidas_gratuitas_items (salida_id);

-- inventario_movimientos.origen tenía un CHECK que solo permitía
-- MANUAL/VENTA/CONTEO; se amplía para registrar el origen real de estos
-- movimientos (el código ya tolera que esto falle y cae a 'MANUAL').
ALTER TABLE inventario_movimientos DROP CONSTRAINT IF EXISTS inventario_movimientos_origen_check;
ALTER TABLE inventario_movimientos
  ADD CONSTRAINT inventario_movimientos_origen_check
  CHECK (origen IN ('MANUAL', 'VENTA', 'CONTEO', 'SALIDA_GRATUITA', 'ANULACION_SALIDA_GRATUITA'));

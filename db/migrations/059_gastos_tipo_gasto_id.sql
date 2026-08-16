-- La tabla gastos en producción fue creada antes de que existiera el
-- catálogo tipos_gasto, con una columna "categoria" (texto libre) en vez de
-- "tipo_gasto_id" (FK a tipos_gasto). La migración 034 (CREATE TABLE IF NOT
-- EXISTS) nunca llegó a aplicarse porque la tabla ya existía, dejando el
-- código (que siempre asumió tipo_gasto_id) desincronizado con la BD real.
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_gasto_id INTEGER REFERENCES tipos_gasto(id);

-- Backfill best-effort para filas existentes que tengan "categoria" con un
-- nombre que coincida con algún tipo de gasto ya catalogado.
UPDATE gastos g
SET tipo_gasto_id = tg.id
FROM tipos_gasto tg
WHERE g.tipo_gasto_id IS NULL AND lower(g.categoria) = lower(tg.nombre);

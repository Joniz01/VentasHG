-- Permite marcar un cliente como proveedor para que aparezca en búsquedas de compras
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS es_proveedor BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_clientes_es_proveedor ON clientes (es_proveedor) WHERE es_proveedor = TRUE;

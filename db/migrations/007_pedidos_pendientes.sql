-- Soporte para pedidos con despacho pendiente (pestaña "Pedidos Pendientes")

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS despacho_pendiente BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hora_entrega TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hora_preparacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_asignado TEXT,
  ADD COLUMN IF NOT EXISTS pedido_entregado BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ventas_pedidos_pendientes
  ON ventas (despacho_pendiente, pedido_entregado);

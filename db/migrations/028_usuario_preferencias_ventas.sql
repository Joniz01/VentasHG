-- Preferencias de formulario de ventas por usuario (override del global de configuración)
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ventas_modo_vista TEXT DEFAULT NULL,   -- 'clasico' | 'pasos' | NULL (usar global)
  ADD COLUMN IF NOT EXISTS ventas_orden_pasos TEXT DEFAULT NULL;  -- 'default' | 'entrega_primero' | NULL (usar global)

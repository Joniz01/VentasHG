-- Agrega motivo de ajuste a movimientos de inventario
ALTER TABLE inventario_movimientos
  ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT
    CHECK (motivo_ajuste IN ('MERMA','VENCIMIENTO','PERDIDA','ROBO','CORRECCION','PRODUCCION','DONACION','OTRO'));

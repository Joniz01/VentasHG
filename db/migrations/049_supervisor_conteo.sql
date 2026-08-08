-- Fase 4: permiso para aprobar conteos de inventario

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ve_autorizar_conteo BOOLEAN NOT NULL DEFAULT FALSE;

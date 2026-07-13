-- Permiso para eliminar facturas de compra anuladas
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ve_eliminar_compras BOOLEAN NOT NULL DEFAULT FALSE;

-- ADMIN recibe el permiso automáticamente
UPDATE usuarios SET ve_eliminar_compras = TRUE WHERE rol = 'ADMIN';

-- Grupo maestro del producto
ALTER TABLE productos ADD COLUMN IF NOT EXISTS grupo VARCHAR(20) DEFAULT 'PARA_LA_VENTA';

-- Productos actuales que empiezan con Bandeja, Ración/Racion, Combo → Para la Venta
UPDATE productos
SET grupo = 'PARA_LA_VENTA'
WHERE grupo IS NULL
   OR (nombre ILIKE 'Bandeja%' OR nombre ILIKE 'Raci%' OR nombre ILIKE 'Combo%');

-- Nombre de empresa en configuración
INSERT INTO configuracion (clave, valor)
VALUES ('nombre_empresa', '')
ON CONFLICT (clave) DO NOTHING;

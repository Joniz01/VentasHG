-- Agrega los datos del proveedor (RIF/CI, teléfono, dirección) a gastos,
-- para reflejar el mismo nivel de detalle que ya tiene Compras. El nombre
-- del proveedor sigue viviendo en la columna existente "proveedor".
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS proveedor_rif TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS proveedor_telefono TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS proveedor_direccion TEXT;

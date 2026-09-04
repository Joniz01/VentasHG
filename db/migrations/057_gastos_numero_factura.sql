-- Permite asociar el número de factura al cargar un gasto desde una factura escaneada
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_factura TEXT;

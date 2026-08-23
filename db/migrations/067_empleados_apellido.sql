-- Separar nombre en nombre + apellido para empleados
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS apellido TEXT;

-- Datos personales adicionales del empleado
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS cedula TEXT;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS sexo TEXT CHECK (sexo IN ('MASCULINO','FEMENINO'));

-- Salario base en $ (fuente) + tasa usada al registrar, además del Bs ya existente
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS salario_base_usd NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tasa_registro NUMERIC(12,4) NOT NULL DEFAULT 0;

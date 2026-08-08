-- Agrega columna metodo_inicial a cashea_pagos para registrar la forma de pago de la cuota inicial
ALTER TABLE cashea_pagos ADD COLUMN IF NOT EXISTS metodo_inicial TEXT;

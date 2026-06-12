ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS delivery_pagado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_pagado_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ventas_delivery_pagado
  ON ventas (despacho_pendiente, delivery_pagado);

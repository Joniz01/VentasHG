-- Corrección de datos históricos: antes de las migraciones 040 y del fix de
-- Cashea/Yummy, ni el inicial de Cashea ni el financiado/monto liquidado de
-- Cashea/Yummy quedaban registrados en pagos_venta, por lo que no aparecían
-- en el reporte de Formas de Pago. Este backfill los reconstruye una sola
-- vez, usando como fecha por defecto la fecha real en que ocurrió cada evento:
--   - Inicial de Cashea  -> fecha de la venta (se cobró ese día)
--   - Financiado Cashea  -> fecha en que se marcó liquidado (liquidado_at),
--                           o la fecha de la venta si no hay liquidado_at
--   - Monto Yummy        -> igual que el financiado de Cashea
-- Es seguro ejecutarlo más de una vez: los NOT EXISTS evitan duplicados.

-- 1) Inicial de Cashea que nunca se insertó en pagos_venta
INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago)
SELECT cp.venta_id, cp.metodo_inicial, cp.monto_inicial, v.fecha
FROM cashea_pagos cp
JOIN ventas v ON v.id = cp.venta_id
WHERE cp.metodo_inicial IS NOT NULL
  AND cp.monto_inicial > 0
  AND NOT EXISTS (
    SELECT 1 FROM pagos_venta pv
    WHERE pv.venta_id = cp.venta_id AND pv.metodo = cp.metodo_inicial
  );

-- 2) Financiado de Cashea ya liquidado antes del fix
INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago)
SELECT cp.venta_id, 'CASHEA', cp.monto_financiado, COALESCE(cp.liquidado_at::date, v.fecha)
FROM cashea_pagos cp
JOIN ventas v ON v.id = cp.venta_id
WHERE cp.liquidado = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM pagos_venta pv
    WHERE pv.venta_id = cp.venta_id AND pv.metodo = 'CASHEA'
  );

-- 3) Monto de Yummy ya liquidado antes del fix
INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago)
SELECT yp.venta_id, 'YUMMY', yp.monto, COALESCE(yp.liquidado_at::date, v.fecha)
FROM yummy_pagos yp
JOIN ventas v ON v.id = yp.venta_id
WHERE yp.liquidado = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM pagos_venta pv
    WHERE pv.venta_id = yp.venta_id AND pv.metodo = 'YUMMY'
  );

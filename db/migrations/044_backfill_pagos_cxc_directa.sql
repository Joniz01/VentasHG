-- Backfill de CxC Directas ya cobradas antes de que se sincronizaran
-- automáticamente con pagos_venta. Usa cuenta_cobrada_at como fecha_pago
-- (o la fecha de la venta si no tiene). Es seguro ejecutarlo más de una vez.
INSERT INTO pagos_venta (venta_id, metodo, monto, fecha_pago)
SELECT v.id,
       'CXC_DIRECTA'::metodo_pago,
       COALESCE(
         (SELECT SUM(vi.precio_unit * vi.cantidad) FROM venta_items vi WHERE vi.venta_id = v.id),
         0
       ) + COALESCE(v.costo_delivery, 0),
       COALESCE(v.cuenta_cobrada_at::date, v.fecha)
FROM ventas v
WHERE v.cuenta_por_cobrar = TRUE
  AND v.cuenta_cobrada = TRUE
  AND NOT EXISTS (SELECT 1 FROM cashea_pagos cp WHERE cp.venta_id = v.id)
  AND NOT EXISTS (SELECT 1 FROM yummy_pagos  yp WHERE yp.venta_id = v.id)
  AND NOT EXISTS (
    SELECT 1 FROM pagos_venta pv
    WHERE pv.venta_id = v.id AND pv.metodo = 'CXC_DIRECTA'::metodo_pago
  );

-- Fecha real en que se recibió el pago (distinta de la fecha de la venta).
-- Se usa para atribuir correctamente al reporte de Formas de Pago el
-- cobro del financiado de Cashea o del monto de Yummy cuando se marcan
-- como pagados, en el día en que efectivamente entró el dinero (que puede
-- no ser el día en que el operador lo marca en el sistema).
ALTER TABLE pagos_venta ADD COLUMN IF NOT EXISTS fecha_pago DATE;

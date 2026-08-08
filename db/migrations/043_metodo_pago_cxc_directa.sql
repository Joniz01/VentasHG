-- Agrega el método de pago CXC_DIRECTA al enum metodo_pago.
-- Se usa para registrar en pagos_venta las cuentas por cobrar directas
-- cuando se marcan como cobradas, permitiendo que aparezcan en el
-- reporte de Formas de Pago.
ALTER TYPE metodo_pago ADD VALUE IF NOT EXISTS 'CXC_DIRECTA';

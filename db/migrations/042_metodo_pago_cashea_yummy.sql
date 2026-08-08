-- Agrega los métodos de pago CASHEA y YUMMY al enum metodo_pago.
-- Deben existir antes de ejecutar el backfill (041).
ALTER TYPE metodo_pago ADD VALUE IF NOT EXISTS 'CASHEA';
ALTER TYPE metodo_pago ADD VALUE IF NOT EXISTS 'YUMMY';

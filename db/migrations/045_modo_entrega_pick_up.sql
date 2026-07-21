-- Agrega PICK_UP al enum modo_entrega si no existe.
ALTER TYPE modo_entrega ADD VALUE IF NOT EXISTS 'PICK_UP';

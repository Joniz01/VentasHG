-- Permite combinar Precio fijo / Descuento % con Producto gratis en una
-- misma promoción (antes eran mutuamente excluyentes vía la columna "tipo").
-- También exige fecha_inicio (antes opcional).
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS descuento_tipo TEXT CHECK (descuento_tipo IN ('PORCENTAJE', 'PRECIO_FIJO'));
ALTER TABLE promociones ADD COLUMN IF NOT EXISTS tiene_producto_gratis BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promociones' AND column_name = 'tipo') THEN
    UPDATE promociones SET descuento_tipo = 'PORCENTAJE' WHERE tipo = 'DESCUENTO_PORCENTAJE' AND descuento_tipo IS NULL;
    UPDATE promociones SET descuento_tipo = 'PRECIO_FIJO' WHERE tipo = 'PRECIO_FIJO' AND descuento_tipo IS NULL;
    UPDATE promociones SET tiene_producto_gratis = TRUE WHERE tipo = 'PRODUCTO_GRATIS';
    ALTER TABLE promociones DROP CONSTRAINT IF EXISTS promociones_tipo_check;
    ALTER TABLE promociones DROP COLUMN tipo;
  END IF;
END $$;

UPDATE promociones SET fecha_inicio = created_at::date WHERE fecha_inicio IS NULL;
ALTER TABLE promociones ALTER COLUMN fecha_inicio SET NOT NULL;

ALTER TABLE promociones DROP CONSTRAINT IF EXISTS promociones_descuento_o_gratis_check;
ALTER TABLE promociones
  ADD CONSTRAINT promociones_descuento_o_gratis_check
  CHECK (descuento_tipo IS NOT NULL OR tiene_producto_gratis = TRUE);

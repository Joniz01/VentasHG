ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 99;

-- Asignar orden según nombres estándar (case-insensitive)
UPDATE categorias SET orden = 1  WHERE LOWER(nombre) LIKE '%queso%';
UPDATE categorias SET orden = 2  WHERE LOWER(nombre) LIKE '%premium%';
UPDATE categorias SET orden = 3  WHERE LOWER(nombre) LIKE '%especial%';
UPDATE categorias SET orden = 4  WHERE LOWER(nombre) LIKE '%masa%' AND LOWER(nombre) LIKE '%intervenid%';
UPDATE categorias SET orden = 5  WHERE LOWER(nombre) LIKE '%variado%' OR LOWER(nombre) LIKE '%variada%';
UPDATE categorias SET orden = 6  WHERE LOWER(nombre) LIKE '%racion%';
UPDATE categorias SET orden = 7  WHERE LOWER(nombre) LIKE '%combo%' OR LOWER(nombre) LIKE '%pack%';
UPDATE categorias SET orden = 8  WHERE LOWER(nombre) LIKE '%bebida%';

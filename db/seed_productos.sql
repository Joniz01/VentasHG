-- =============================================================
-- SEED: Catálogo de productos de VentasHG
-- Ejecutar DESPUÉS de schema_completo.sql
-- Incluye categorías, extras y productos con costo/precio.
-- =============================================================

-- Categorías
INSERT INTO categorias (nombre) VALUES
  ('Queso'),
  ('Premium'),
  ('Especiales'),
  ('Masas Intervenidas'),
  ('Combos y Pack'),
  ('Raciones')
ON CONFLICT (nombre) DO NOTHING;

-- Extras
INSERT INTO extras_catalogo (nombre) VALUES ('Frito')
ON CONFLICT (nombre) DO NOTHING;

-- Productos
INSERT INTO productos (nombre, costo, precio_venta, categoria_id)
SELECT v.nombre, v.costo, v.precio_venta, c.id
FROM (VALUES
  ('Bandeja 20 Tradicionales',          2.32,   7, 'Queso'),
  ('Bandeja 15 Doble Queso',            3.64,  10, 'Queso'),
  ('Bandeja 15 Capresa',                2.21,  12, 'Premium'),
  ('Bandeja 15 Plátano',                2.75,  12, 'Premium'),
  ('Bandeja 15 Guayaba con Queso',      2.78,  12, 'Premium'),
  ('Bandeja 15 Chocolate',              3.17,  12, 'Premium'),
  ('Bandeja 15 Nucita',                 3.17,  12, 'Premium'),
  ('Bandeja 15 Manzana',                2.84,  12, 'Premium'),
  ('Bandeja 15 Peperoni',               4.64,  14, 'Especiales'),
  ('Bandeja 15 Jamón y Queso',          5.54,  14, 'Especiales'),
  ('Bandeja 15 Ajoporro',               3.71,  14, 'Especiales'),
  ('Bandeja 15 Pastel de Pescado',      2.21,  14, 'Especiales'),
  ('Bandeja 15 Camarón',               10.04,  16, 'Especiales'),
  ('Bandeja 15 Catalana',               5.24,  14, 'Especiales'),
  ('Bandeja 15 Chistorra',              4.88,  14, 'Especiales'),
  ('Bandeja 15 Toblerón',               2.75,  14, 'Especiales'),
  ('Bandeja 15 Golfiado',               2.72,  12, 'Masas Intervenidas'),
  ('Bandeja 15 Masa Pesto',             2.96,  12, 'Masas Intervenidas'),
  ('Bandeja 15 Integral',               3.65,  12, 'Masas Intervenidas'),
  ('Combo 80Q Fritos',                  9.38,  30, 'Combos y Pack'),
  ('Combo 60 Doble Queso Fritos',      14.82,  40, 'Combos y Pack'),
  ('Combo 80 Queso Tradicionales',      9.34,  25, 'Combos y Pack'),
  ('Combo 60 Doble Queso',             14.63,  35, 'Combos y Pack'),
  ('Caja 40 Tequeños Tradicionales',    5.16,  15, 'Combos y Pack'),
  ('Combo 80 Queso Tradicionales 8cm', 12.12,  30, 'Combos y Pack'),
  ('Combo 100 Queso Tradicionales',    11.63,  32, 'Combos y Pack'),
  ('Combo Pack Fiestero',              15.61,  45, 'Combos y Pack'),
  ('Combo Pack Degustación Especial',  15.59,  40, 'Combos y Pack'),
  ('Combo Pack Degustación Marino',    21.20,  40, 'Combos y Pack'),
  ('Combo Doble Queso 80 8cm',         14.30,  38, 'Combos y Pack'),
  ('Ración 10 Tequeños Tradicionales',  1.22,   4, 'Raciones'),
  ('Ración 5 Doble Queso',              1.33,   4, 'Raciones'),
  ('Ración 5 Guayaba con Queso',        0.97,   5, 'Raciones'),
  ('Ración 5 Manzana Canela',           0.95,   5, 'Raciones'),
  ('Ración 5 Capresa',                  0.77,   5, 'Raciones'),
  ('Ración 5 Camarón',                  3.37,   6, 'Raciones'),
  ('Ración 5 Jamón con Queso',          1.76,   6, 'Raciones'),
  ('Ración 5 Integral',                 1.29,   5, 'Raciones'),
  ('Ración 5 Plátano con Queso',        0.96,   5, 'Raciones'),
  ('Ración 5 Peperoni Mozarella',       1.63,   6, 'Raciones'),
  ('Ración 5 Chistorra con Mozarella',  1.66,   6, 'Raciones'),
  ('Ración 5 Chocolate',                1.07,   5, 'Raciones'),
  ('Ración 5 Nucita',                   1.07,   5, 'Raciones'),
  ('Ración 5 Ajoporro con Tocineta',    1.03,   6, 'Raciones'),
  ('Ración 5 Tobleronee',               0.74,   6, 'Raciones'),
  ('Ración 5 Catalana',                 1.76,   6, 'Raciones'),
  ('Ración 5 Golfiado',                 0.92,   5, 'Raciones'),
  ('Ración 5 Pastel de Pescado',        0.74,   6, 'Raciones'),
  ('Ración 5 Masa Pesto',               1.05,   5, 'Raciones')
) AS v(nombre, costo, precio_venta, categoria)
JOIN categorias c ON c.nombre = v.categoria
WHERE NOT EXISTS (
  SELECT 1 FROM productos p WHERE p.nombre = v.nombre
);

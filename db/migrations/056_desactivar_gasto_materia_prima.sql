-- Se elimina "Gasto Materia Prima" de la lista de tipos de gasto (soft-delete)
UPDATE tipos_gasto SET activo = FALSE WHERE nombre = 'Gasto Materia Prima';

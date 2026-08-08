-- Configuración del modo de vista y secciones del formulario de ventas
INSERT INTO configuracion (clave, valor) VALUES ('ventas_modo_vista', 'clasico') ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('ventas_paso1_abierto', 'true')  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('ventas_paso2_abierto', 'true')  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('ventas_paso3_abierto', 'true')  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('ventas_paso4_abierto', 'true')  ON CONFLICT (clave) DO NOTHING;

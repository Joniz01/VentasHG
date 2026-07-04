# Historial de Versiones — VentasHG / VentasFactory

Cada versión lista los archivos modificados, archivos nuevos, migraciones SQL y variables de entorno necesarias.
Cuando una sesión de VentasFactory pregunte "¿qué debo aplicar?", leer este archivo y aplicar las versiones que aún no estén en ese repositorio.

---

## v1.1 — 2026-07-04

### Resumen
- Personalización del header por instancia (nombre y color)
- Menú de perfil (logout, cambiar clave, teléfono/correo)
- Fecha en Pedidos Pendientes
- Redirección default a /ventas
- Advertencia al salir de Ventas con datos sin guardar
- Reporte limpio compartible + imagen punto de venta desde DB
- Configuración del sistema en Admin

---

### Estructura de rutas (CAMBIO IMPORTANTE)
El directorio `app/` fue reestructurado con route groups para que `/reportes/vista` tenga layout limpio (sin nav):

```
app/
  (main)/          ← todas las páginas con nav/header
    layout.tsx     ← copia del antiguo app/layout.tsx (ajustar globals.css import a ../globals.css)
    admin/page.tsx
    dashboard/page.tsx
    delivery/page.tsx
    page.tsx
    pedidos-pendientes/page.tsx
    productos/page.tsx
    reportes/page.tsx
    sin-acceso/page.tsx
    ventas/page.tsx
  (clean)/         ← páginas sin nav (layout mínimo)
    layout.tsx
    reportes/vista/
      page.tsx
      ImagenPuntoToggle.tsx
  api/             ← sin cambios en ubicación
  globals.css      ← sin cambios en ubicación
  favicon.ico
  manifest.ts
```
El antiguo `app/layout.tsx` raíz se elimina. Cada route group tiene su propio `layout.tsx` con `<html>` y `<body>`.

---

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/(main)/layout.tsx` | Layout principal con header/nav (era `app/layout.tsx`) |
| `app/(clean)/layout.tsx` | Layout mínimo sin nav para páginas públicas |
| `app/(clean)/reportes/vista/page.tsx` | Vista limpia del reporte (solo tarjeta resumen) |
| `app/(clean)/reportes/vista/ImagenPuntoToggle.tsx` | Toggle ◇/◆ para imagen punto de venta |
| `app/api/reportes/imagen/route.ts` | GET y POST para imagen punto de venta en DB |
| `app/api/configuracion/route.ts` | GET y PUT para tabla configuracion |
| `app/api/usuarios/perfil/route.ts` | GET y PUT para teléfono/correo del usuario |
| `components/PerfilMenu.tsx` | Menú de perfil (logout, clave, teléfono/correo) |
| `components/ConfiguracionClient.tsx` | UI de configuración en Admin (días retención imágenes) |
| `lib/getReporte.ts` | Función compartida de consulta de reporte para servidor |
| `db/migrations/017_usuario_perfil.sql` | ADD COLUMN telefono, correo a usuarios |
| `db/migrations/018_reporte_imagenes.sql` | Tabla reporte_imagenes (desde, hasta, data) |
| `db/migrations/019_configuracion.sql` | Tabla configuracion (clave, valor) |

---

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `app/(main)/layout.tsx` | Lee `EMPRESA_NOMBRE` y `EMPRESA_COLOR` del env; agrega `<PerfilMenu>`; import globals.css con ruta `../globals.css` |
| `app/(main)/page.tsx` | ADMIN redirige a `/ventas` (antes `/productos`) |
| `app/api/pedidos-pendientes/route.ts` | SELECT incluye `fecha`; fix conversión Date→string |
| `lib/types.ts` | Agrega `fecha: string` a `PedidoPendiente` |
| `components/PedidosPendientesClient.tsx` | Muestra `Fecha: DD/MM/YYYY` debajo de Hora de entrega (pendientes y entregados) |
| `components/VentasClient.tsx` | Importa `useCallback`; agrega `hayDatosIngresados()` y efecto `beforeunload` |
| `components/ReportesClient.tsx` | Botones WhatsApp + Imagen punto de venta + Copiar enlace limpio; imagen se sube a DB; ◇ aparece si existe imagen para esa fecha; función `comprimirImagen` (JPEG 75%); sin botón "Descargar imagen" |
| `components/AdminTabsClient.tsx` | Agrega tab "Configuración" con `ConfiguracionClient` |
| `proxy.ts` | Sin cambios de estructura, verificar que el matcher excluya los paths necesarios |

---

### Migraciones SQL (ejecutar en Neon en orden)

**017_usuario_perfil.sql**
```sql
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS correo TEXT;
```

**018_reporte_imagenes.sql**
```sql
DROP TABLE IF EXISTS reporte_imagenes;
CREATE TABLE reporte_imagenes (
  desde DATE NOT NULL,
  hasta DATE NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (desde, hasta)
);
```

**019_configuracion.sql**
```sql
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO configuracion (clave, valor) VALUES ('imagen_retencion_dias', '7')
  ON CONFLICT (clave) DO NOTHING;
```

---

### Variables de entorno (agregar en Vercel)

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `EMPRESA_NOMBRE` | `Factory HG` | Nombre que aparece en el header |
| `EMPRESA_COLOR` | `#bbf7d0` | Color de fondo del header (hex, opcional) |
| `NEXT_PUBLIC_EMPRESA_NOMBRE` | `Factory HG` | Mismo valor que EMPRESA_NOMBRE, visible en cliente (para mensaje WhatsApp) |

---

---

## v1.4 — 2026-07-04

### Resumen
- Inicialización de inventario en Admin: lleva a cero el stock de todos los productos normales activos
- Doble confirmación con checkbox antes de ejecutar el reset

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `app/api/inventario/reset/route.ts` | POST protegido (solo ADMIN): lleva stock a 0 y registra movimiento AJUSTE por producto |
| `components/InventarioInicialClient.tsx` | UI: lista stock actual, advertencia, checkbox de confirmación, botón de ejecución |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/AdminTabsClient.tsx` | Import de `InventarioInicialClient`; nueva tab "Inventario Inicial" entre "Configuración" y "Acceso al Sistema" |

### Sin migraciones SQL ni variables de entorno nuevas

---

## v1.3.1 — 2026-07-04

### Resumen
- Fix: al seleccionar "Motorizado de la Empresa" como tipo de delivery, mostrar el selector de motorizados (igual que antes)
- Grid de parámetros de entrega cambiado a `sm:grid-cols-2 lg:grid-cols-4` para acomodar los 4 campos

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `components/VentasClient.tsx` | Agrega selector de motorizado condicionado a `modoEntrega === "DELIVERY" && tipoDelivery === "EMPRESA"`; ajusta grid |

### Sin migraciones SQL ni variables de entorno nuevas

---

## v1.3 — 2026-07-04

### Resumen
- Modo de entrega por defecto configurable (Local/Delivery) en Admin/Configuración
- Eliminar campo "Modalidad de entrega" de la UI de ventas (columna se mantiene en BD)
- Sub-selector de tipo de delivery: Motorizado de la Empresa, Wink, Yummy
  - Empresa: monto libre
  - Wink: precio por defecto configurable ($3), editable
  - Yummy: campo deshabilitado (sin costo)
- % de descuento en ventas (aplica al subtotal de productos, no al delivery)
  - Controlado por permiso `ve_descuento` por usuario en Admin/Acceso al Sistema
  - ADMIN tiene el permiso siempre habilitado

### Archivos NUEVOS

| Archivo | Descripción |
|---------|-------------|
| `db/migrations/020_ventas_descuento_tipo_delivery.sql` | Agrega columnas ve_descuento, descuento_porcentaje, tipo_delivery + config keys |

### Archivos MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `lib/types.ts` | Agrega `descuento` a `PERMISO_TABS`/`PERMISOS_VACIOS`; agrega `TIPOS_DELIVERY`, `TipoDelivery`, `TIPO_DELIVERY_LABELS`; agrega `tipoDelivery` y `descuentoPorcentaje` a `Venta` |
| `lib/auth.ts` | Incluye `ve_descuento` en SELECT de sesión y mapeo de permisos |
| `lib/ventas.ts` | Agrega `tipoDelivery` y `descuentoPorcentaje` a `VentaBody` |
| `app/api/usuarios/route.ts` | GET/POST incluyen `ve_descuento`; ADMIN lo recibe `true` |
| `app/api/usuarios/[id]/route.ts` | PUT incluye `ve_descuento` |
| `app/api/ventas/route.ts` | GET y POST incluyen `tipo_delivery` y `descuento_porcentaje` |
| `app/api/ventas/[id]/route.ts` | PUT incluye `tipo_delivery` y `descuento_porcentaje` |
| `app/(main)/ventas/page.tsx` | Pasa `puedeDescuento` a VentasClient |
| `components/VentasClient.tsx` | Default modoEntrega desde config; elimina UI "Modalidad de compra"; sub-selector tipo_delivery; campo descuento si tiene permiso; totales con descuento |
| `components/ConfiguracionClient.tsx` | Agrega selectores modo_entrega_default y wink_costo_default |

### Migraciones SQL (ejecutar en Neon en orden)

**020_ventas_descuento_tipo_delivery.sql**
```sql
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS ve_descuento BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_delivery TEXT;

INSERT INTO configuracion (clave, valor) VALUES ('modo_entrega_default', 'DELIVERY')
  ON CONFLICT (clave) DO NOTHING;
INSERT INTO configuracion (clave, valor) VALUES ('wink_costo_default', '3')
  ON CONFLICT (clave) DO NOTHING;
```

### Sin cambios de variables de entorno

---

## v1.2 — 2026-07-04

### Resumen
- Imagen punto de venta: ampliar al click (lightbox), botón eliminar
- Paginación con selector de cantidad en Reportes (ventas por cliente, ventas por producto), Pagos a Delivery, Productos, Ventas

### Archivos NUEVOS
| Archivo | Descripción |
|---------|-------------|
| `components/Paginador.tsx` | Componente reutilizable de paginación con selector de ítems por página |

### Archivos MODIFICADOS
| Archivo | Cambios |
|---------|---------|
| `app/api/reportes/imagen/route.ts` | Agrega método DELETE para eliminar imagen por (desde, hasta) |
| `app/(clean)/reportes/vista/ImagenPuntoToggle.tsx` | Lightbox al hacer click en la imagen |
| `components/ReportesClient.tsx` | Lightbox + botón eliminar imagen; paginación 10/15/20/25/50 en "por cliente" y "por producto" |
| `components/DeliveryPagosPanel.tsx` | Paginación 10/15/20/25/50 en la tabla de pagos |
| `components/ProductosClient.tsx` | Paginación 15/25/50/100 (default 25) en la tabla de productos |
| `components/VentasClient.tsx` | Paginación 15/25/50/100 (default 25) en la lista de ventas |

### Sin cambios de BD ni de env vars

---

## v1.0 — baseline

Estado inicial del proyecto antes del registro de versiones.
